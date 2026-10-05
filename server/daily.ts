import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { COUNTDOWN_MS, roundEndsAt } from "../shared/countdown.ts";
import type { GameHistoryDetail, GameHistoryItem } from "../shared/account.ts";
import {
  DAILY_DURATION_SEC,
  dailyGameId,
  dailyRating,
  fieldIndex,
  gridPoints,
  parisDay,
  parseDailyGameId,
  previousParisDay,
  streakDays,
  type DailyArchiveDetail,
  type DailyArchiveRow,
  type DailyFoundWord,
  type DailyOverview,
  type DailyPlayState,
  type DailySolution,
  type DailyStanding,
} from "../shared/daily.ts";
import { isValidPath, pathToWord, wordPoints } from "../shared/dice.ts";
import {
  DEFAULT_SETTINGS,
  PLAYER_COLORS,
  type Cell,
  type FoundWord,
  type GameSettings,
  type PossibleWord,
  type WordFailReason,
} from "../shared/types.ts";
import { findAuthUser } from "./auth.ts";
import { lookupWord } from "./dictionary.ts";
import { rollPlayableGrid } from "./solver.ts";

const DAILY_HISTORY_COLOR = PLAYER_COLORS[3];

const here = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(here, "../data/lexo.sqlite"));
db.pragma("journal_mode = WAL");

const DAILY_SETTINGS: GameSettings = {
  ...DEFAULT_SETTINGS,
  durationSec: DAILY_DURATION_SEC,
  difficulty: "medium",
};

type PuzzleRow = {
  day: string;
  grid_json: string;
  words_json: string;
  settings_json: string;
};

type EntryRow = {
  day: string;
  user_id: string;
  name: string;
  score: number;
  words_json: string;
  started_at: number;
  finished_at: number | null;
};

export function migrateDaily() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_puzzles (
      day TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      grid_json TEXT NOT NULL,
      words_json TEXT NOT NULL,
      settings_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_entries (
      day TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      words_json TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      PRIMARY KEY (day, user_id)
    );
  `);
}

function parseWords(raw: string): DailyFoundWord[] {
  try {
    const words = JSON.parse(raw) as DailyFoundWord[];
    return Array.isArray(words) ? words : [];
  } catch {
    return [];
  }
}

async function ensurePuzzle(day: string): Promise<{ grid: Cell[]; words: PossibleWord[]; settings: GameSettings }> {
  const existing = db.prepare(`SELECT grid_json, words_json, settings_json FROM daily_puzzles WHERE day = ?`).get(day) as
    | PuzzleRow
    | undefined;
  if (existing) {
    return {
      grid: JSON.parse(existing.grid_json) as Cell[],
      words: JSON.parse(existing.words_json) as PossibleWord[],
      settings: JSON.parse(existing.settings_json) as GameSettings,
    };
  }
  const dealt = await rollPlayableGrid(DAILY_SETTINGS);
  try {
    db.prepare(
      `INSERT INTO daily_puzzles (day, created_at, grid_json, words_json, settings_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(day, Date.now(), JSON.stringify(dealt.grid), JSON.stringify(dealt.words), JSON.stringify(DAILY_SETTINGS));
  } catch {
    const raced = db.prepare(`SELECT grid_json, words_json, settings_json FROM daily_puzzles WHERE day = ?`).get(day) as
      | PuzzleRow
      | undefined;
    if (raced) {
      return {
        grid: JSON.parse(raced.grid_json) as Cell[],
        words: JSON.parse(raced.words_json) as PossibleWord[],
        settings: JSON.parse(raced.settings_json) as GameSettings,
      };
    }
    throw new Error("Grille du jour indisponible");
  }
  return { grid: dealt.grid, words: dealt.words, settings: DAILY_SETTINGS };
}

function entry(day: string, userId: string): EntryRow | undefined {
  return db
    .prepare(
      `SELECT day, user_id, name, score, words_json, started_at, finished_at
       FROM daily_entries WHERE day = ? AND user_id = ?`,
    )
    .get(day, userId) as EntryRow | undefined;
}

function saveEntry(row: EntryRow) {
  db.prepare(
    `UPDATE daily_entries
     SET name = ?, score = ?, words_json = ?, finished_at = ?
     WHERE day = ? AND user_id = ?`,
  ).run(row.name, row.score, row.words_json, row.finished_at, row.day, row.user_id);
}

function finishIfExpired(row: EntryRow, now = Date.now()): EntryRow {
  if (row.finished_at) return row;
  if (now < roundEndsAt(row.started_at, DAILY_DURATION_SEC * 1000)) return row;
  row.finished_at = roundEndsAt(row.started_at, DAILY_DURATION_SEC * 1000);
  saveEntry(row);
  return row;
}

function leaderboard(day: string, userId: string): DailyStanding[] {
  const rows = db
    .prepare(
      `SELECT day, user_id, name, score, finished_at
       FROM daily_entries
       WHERE finished_at IS NOT NULL`,
    )
    .all() as { day: string; user_id: string; name: string; score: number; finished_at: number }[];

  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.day >= day) continue;
    byDay.set(row.day, Math.max(byDay.get(row.day) ?? 0, row.score));
  }

  const byUser = new Map<
    string,
    {
      name: string;
      playedAt: number;
      total: number;
      plays: number;
      closed: Map<string, number>;
      today: number | null;
    }
  >();
  for (const row of rows) {
    const current = byUser.get(row.user_id) ?? {
      name: row.name,
      playedAt: 0,
      total: 0,
      plays: 0,
      closed: new Map(),
      today: null,
    };
    current.total += row.score;
    current.plays += 1;
    if (row.day < day) current.closed.set(row.day, row.score);
    if (row.finished_at >= current.playedAt) {
      current.playedAt = row.finished_at;
      current.name = row.name;
    }
    if (row.day === day) current.today = row.score;
    byUser.set(row.user_id, current);
  }

  const yesterday = previousParisDay(day);
  const ranked = [...byUser.entries()]
    .map(([id, stats]) => {
      const user = findAuthUser(id);
      const streak = streakDays(new Set(stats.closed.keys()), yesterday);
      const indexSum = streak.reduce(
        (sum, playedDay) => sum + fieldIndex(stats.closed.get(playedDay) ?? 0, byDay.get(playedDay) ?? 0),
        0,
      );
      return {
        userId: id,
        name: user?.name?.trim() || stats.name || "Joueur",
        image: user?.image ?? null,
        plays: stats.plays,
        average: stats.plays ? stats.total / stats.plays : 0,
        rating: dailyRating(indexSum, streak.length),
        today: stats.today,
        you: id === userId,
      };
    })
    .sort(
      (a, b) => b.rating - a.rating || b.plays - a.plays || a.name.localeCompare(b.name, "fr"),
    );

  const withRank = ranked.map((row, index) => ({ ...row, rank: index + 1 }));
  const top = withRank.slice(0, 20);
  const mine = withRank.find((row) => row.you);
  if (mine && !top.some((row) => row.you)) top.push(mine);
  return top;
}

function puzzleWords(raw: string): PossibleWord[] {
  try {
    const words = JSON.parse(raw) as PossibleWord[];
    return Array.isArray(words) ? words : [];
  } catch {
    return [];
  }
}

function playerName(userId: string, stored: string): string {
  const user = findAuthUser(userId);
  return user?.name?.trim() || stored.trim() || "Joueur";
}

function archiveRows(): DailyArchiveRow[] {
  const puzzles = db
    .prepare(`SELECT day, words_json FROM daily_puzzles ORDER BY day DESC`)
    .all() as { day: string; words_json: string }[];
  const entries = db
    .prepare(
      `SELECT day, user_id, name, score FROM daily_entries WHERE finished_at IS NOT NULL`,
    )
    .all() as { day: string; user_id: string; name: string; score: number }[];
  const byDay = new Map<string, { name: string; score: number }[]>();
  for (const row of entries) {
    const list = byDay.get(row.day) ?? [];
    list.push({ name: playerName(row.user_id, row.name), score: row.score });
    byDay.set(row.day, list);
  }
  return puzzles.map((puzzle) => {
    const words = puzzleWords(puzzle.words_json);
    const played = byDay.get(puzzle.day) ?? [];
    const best = played.reduce((max, row) => Math.max(max, row.score), -1);
    const names = [
      ...new Set(played.filter((row) => row.score === best).map((row) => row.name)),
    ].sort((a, b) => a.localeCompare(b, "fr"));
    return {
      day: puzzle.day,
      wordCount: words.length,
      possiblePoints: gridPoints(words),
      players: played.length,
      bestScore: best < 0 ? null : best,
      bestNames: best < 0 ? [] : names,
    };
  });
}

export function listDailyArchive(): DailyArchiveRow[] {
  const today = parisDay();
  return archiveRows().filter((row) => row.day < today);
}

export function dailyArchiveDetail(day: string): DailyArchiveDetail | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= parisDay()) return null;
  const puzzle = db
    .prepare(`SELECT grid_json, words_json FROM daily_puzzles WHERE day = ?`)
    .get(day) as { grid_json: string; words_json: string } | undefined;
  if (!puzzle) return null;
  const stats = archiveRows().find((row) => row.day === day);
  if (!stats) return null;
  const revealed = day < parisDay();
  return {
    ...stats,
    revealed,
    grid: revealed ? (JSON.parse(puzzle.grid_json) as Cell[]) : null,
    words: revealed ? puzzleWords(puzzle.words_json) : null,
  };
}

function yesterdaySolution(day: string): DailySolution | null {
  const previous = previousParisDay(day);
  const row = db
    .prepare(`SELECT grid_json, words_json FROM daily_puzzles WHERE day = ?`)
    .get(previous) as { grid_json: string; words_json: string } | undefined;
  if (!row) return null;
  return {
    day: previous,
    grid: JSON.parse(row.grid_json) as Cell[],
    words: JSON.parse(row.words_json) as PossibleWord[],
  };
}

export async function dailyOverview(userId: string, name: string): Promise<DailyOverview> {
  const day = parisDay();
  await ensurePuzzle(day);
  const raw = entry(day, userId);
  const current = raw ? finishIfExpired({ ...raw, name: name || raw.name }) : undefined;
  if (current && current.name !== raw?.name) saveEntry(current);
  const words = current ? parseWords(current.words_json) : [];
  const played = Boolean(current?.finished_at);
  const inProgress = Boolean(current && !current.finished_at);
  return {
    day,
    played,
    inProgress,
    endsAt: inProgress && current ? roundEndsAt(current.started_at, DAILY_DURATION_SEC * 1000) : null,
    score: current ? current.score : null,
    wordCount: current ? words.length : null,
    words: played ? words : [],
    leaderboard: leaderboard(day, userId),
    yesterday: yesterdaySolution(day),
  };
}

export async function startDaily(
  userId: string,
  name: string,
): Promise<{ play: DailyPlayState } | { done: DailyOverview }> {
  const day = parisDay();
  const puzzle = await ensurePuzzle(day);
  const safeName = name.trim().replace(/\s+/g, " ").slice(0, 16) || "Joueur";
  let current = entry(day, userId);
  if (current) current = finishIfExpired(current);
  if (current?.finished_at) return { done: await dailyOverview(userId, safeName) };
  if (!current) {
    const started = Date.now();
    db.prepare(
      `INSERT INTO daily_entries (day, user_id, name, score, words_json, started_at, finished_at)
       VALUES (?, ?, ?, 0, '[]', ?, NULL)`,
    ).run(day, userId, safeName, started);
    current = entry(day, userId);
  }
  if (!current) return { done: await dailyOverview(userId, safeName) };
  const words = parseWords(current.words_json);
  return {
    play: {
      day,
      grid: puzzle.grid,
      endsAt: roundEndsAt(current.started_at, DAILY_DURATION_SEC * 1000),
      words,
      score: current.score,
    },
  };
}

export async function submitDailyWord(
  userId: string,
  cells: number[],
): Promise<
  { ok: true; words: DailyFoundWord[]; score: number } | { ok: false; reason: WordFailReason; finished?: boolean }
> {
  const day = parisDay();
  const puzzle = await ensurePuzzle(day);
  const current = entry(day, userId);
  if (!current || current.finished_at) return { ok: false, reason: "phase" };
  if (Date.now() < current.started_at + COUNTDOWN_MS) {
    return { ok: false, reason: "phase" };
  }
  if (Date.now() >= roundEndsAt(current.started_at, DAILY_DURATION_SEC * 1000)) {
    finishIfExpired(current);
    return { ok: false, reason: "phase", finished: true };
  }
  if (!Array.isArray(cells) || !isValidPath(cells)) return { ok: false, reason: "path" };
  const built = pathToWord(puzzle.grid, cells);
  if (built.letters < puzzle.settings.minLetters) return { ok: false, reason: "too-short" };
  const found = lookupWord(built.key, puzzle.settings);
  if (!found.ok) return { ok: false, reason: found.reason };
  const words = parseWords(current.words_json);
  if (words.some((word) => word.key === built.key)) return { ok: false, reason: "duplicate" };
  words.push({
    key: built.key,
    display: found.display,
    letters: built.letters,
    points: wordPoints(built.letters, false),
  });
  const score = words.reduce((sum, word) => sum + word.points, 0);
  current.words_json = JSON.stringify(words);
  current.score = score;
  saveEntry(current);
  return { ok: true, words, score };
}

export async function finishDaily(userId: string, name: string): Promise<DailyOverview> {
  const day = parisDay();
  const current = entry(day, userId);
  if (
    current &&
    !current.finished_at &&
    Date.now() >= roundEndsAt(current.started_at, DAILY_DURATION_SEC * 1000)
  ) {
    current.finished_at = roundEndsAt(current.started_at, DAILY_DURATION_SEC * 1000);
    current.name = name.trim().replace(/\s+/g, " ").slice(0, 16) || current.name;
    saveEntry(current);
  }
  return await dailyOverview(userId, name);
}

/** Parties Lexo du jour terminées, pour l’historique profil. */
export function listDailyGames(userId: string): GameHistoryItem[] {
  const rows = db
    .prepare(
      `SELECT e.day, e.name, e.score, e.started_at, e.finished_at, p.settings_json
       FROM daily_entries e
       JOIN daily_puzzles p ON p.day = e.day
       WHERE e.user_id = ? AND e.finished_at IS NOT NULL
       ORDER BY e.finished_at DESC
       LIMIT 80`,
    )
    .all(userId) as {
    day: string;
    name: string;
    score: number;
    started_at: number;
    finished_at: number;
    settings_json: string;
  }[];

  return rows.map((row) => {
    const settings = parseSettings(row.settings_json);
    const name = playerName(userId, row.name);
    return {
      id: dailyGameId(row.day),
      kind: "daily" as const,
      solo: true,
      createdAt: row.started_at,
      updatedAt: row.finished_at,
      roundCount: 1,
      difficulty: settings.difficulty,
      yourScore: row.score,
      players: [{ name, color: DAILY_HISTORY_COLOR, score: row.score, you: true }],
    };
  });
}

export function getDailyGame(userId: string, gameId: string): GameHistoryDetail | null {
  const day = parseDailyGameId(gameId);
  if (!day) return null;
  const row = db
    .prepare(
      `SELECT e.day, e.name, e.score, e.words_json, e.started_at, e.finished_at,
              p.grid_json, p.words_json AS puzzle_words_json, p.settings_json
       FROM daily_entries e
       JOIN daily_puzzles p ON p.day = e.day
       WHERE e.user_id = ? AND e.day = ? AND e.finished_at IS NOT NULL`,
    )
    .get(userId, day) as
    | {
        day: string;
        name: string;
        score: number;
        words_json: string;
        started_at: number;
        finished_at: number;
        grid_json: string;
        puzzle_words_json: string;
        settings_json: string;
      }
    | undefined;
  if (!row) return null;

  const settings = parseSettings(row.settings_json);
  const name = playerName(userId, row.name);
  const playerId = "daily";
  /** Grille et mots restent secrets jusqu’au lendemain (Paris), même pour soi. */
  const revealed = day < parisDay();
  const words: FoundWord[] = revealed
    ? parseWords(row.words_json).map((word) => ({
        key: word.key,
        display: word.display,
        letters: word.letters,
        points: word.points,
        shared: false,
      }))
    : [];
  const allWords = revealed ? puzzleWords(row.puzzle_words_json) : [];
  const foundKeys = new Set(words.map((word) => word.key));
  const missed = allWords.filter((word) => !foundKeys.has(word.key));

  return {
    id: dailyGameId(day),
    kind: "daily",
    solo: true,
    createdAt: row.started_at,
    settings,
    rounds: [
      {
        round: 1,
        startedAt: row.started_at,
        endedAt: row.finished_at,
        grid: revealed ? (JSON.parse(row.grid_json) as Cell[]) : null,
        recap: [
          {
            playerId,
            name,
            color: DAILY_HISTORY_COLOR,
            words,
            roundScore: row.score,
          },
        ],
        summary: {
          unique: words.map((word, order) => ({
            key: `${playerId}-${word.key}`,
            display: word.display,
            letters: word.letters,
            points: word.points,
            playerId,
            name,
            color: DAILY_HISTORY_COLOR,
            likedBy: [],
            order,
          })),
          shared: [],
          rejected: [],
          missed,
          possibleCount: revealed ? allWords.length : 0,
        },
        players: [{ name, color: DAILY_HISTORY_COLOR, score: row.score, you: true }],
      },
    ],
  };
}

function parseSettings(raw: string): GameSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return { ...DAILY_SETTINGS };
  }
}

