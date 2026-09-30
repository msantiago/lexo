import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import {
  BADGE_BY_ID,
  BADGES,
  COLLECTION_THRESHOLDS,
  GAME_THRESHOLDS,
  LIFETIME_WORD_THRESHOLDS,
  ROUND_SCORE_THRESHOLDS,
  ROUND_WORD_THRESHOLDS,
  WIN_THRESHOLDS,
  WORD_LENGTH_THRESHOLDS,
  badgePublic,
  type BadgeDef,
  type BadgeView,
} from "../shared/badges.ts";
import type {
  DirectoryModeStats,
  GameHistoryDetail,
  GameHistoryItem,
  HistoryPlayer,
  LetterBucket,
  LengthBucket,
  ModeStats,
  ProfilePayload,
  StatsByMode,
  UserStats,
  WordFreq,
  WordStatsPayload,
} from "../shared/account.ts";
import type {
  Cell,
  FoundWord,
  GameSettings,
  RoundSummary,
  WordRecap,
} from "../shared/types.ts";

export type RoundSnapshot = {
  gameId: string | null;
  code: string;
  solo: boolean;
  round: number;
  settings: GameSettings;
  grid: Cell[] | null;
  startedAt: number | null;
  endedAt: number;
  recap: WordRecap[];
  summary: RoundSummary | null;
  players: {
    id: string;
    userId: string | null;
    name: string;
    color: string;
    roundScore: number;
    totalScore: number;
    words: FoundWord[];
    isHost: boolean;
  }[];
};

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "lexo.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function makeId(): string {
  return randomBytes(16).toString("hex");
}

const EMPTY_STATS: UserStats = {
  gamesPlayed: 0,
  roundsPlayed: 0,
  wordsFound: 0,
  uniqueWords: 0,
  totalPoints: 0,
  longestWord: 0,
  bestRoundScore: 0,
  bestRoundWords: 0,
  wins: 0,
  soloGames: 0,
  multiGames: 0,
  hostedGames: 0,
};

export function migrateStore() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      solo INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      settings_json TEXT NOT NULL,
      preview_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      started_at INTEGER,
      ended_at INTEGER NOT NULL,
      grid_json TEXT,
      recap_json TEXT NOT NULL,
      summary_json TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS round_players (
      round_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      round_score INTEGER NOT NULL,
      total_score INTEGER NOT NULL,
      words_json TEXT NOT NULL,
      is_host INTEGER NOT NULL,
      PRIMARY KEY (round_id, player_id),
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_round_players_user ON round_players(user_id);
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id TEXT PRIMARY KEY,
      games_played INTEGER NOT NULL DEFAULT 0,
      rounds_played INTEGER NOT NULL DEFAULT 0,
      words_found INTEGER NOT NULL DEFAULT 0,
      unique_words INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      longest_word INTEGER NOT NULL DEFAULT 0,
      best_round_score INTEGER NOT NULL DEFAULT 0,
      best_round_words INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      solo_games INTEGER NOT NULL DEFAULT 0,
      multi_games INTEGER NOT NULL DEFAULT 0,
      hosted_games INTEGER NOT NULL DEFAULT 0,
      qu_words INTEGER NOT NULL DEFAULT 0,
      shared_words INTEGER NOT NULL DEFAULT 0,
      dict_adds INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_badges (
      user_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      earned_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, badge_id)
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.prepare(`UPDATE user_stats SET wins = (${WINS_SQL})`).run();
}

export function loadUserSettings(userId: string): Partial<GameSettings> | null {
  const row = db.prepare(`SELECT settings_json FROM user_settings WHERE user_id = ?`).get(userId) as
    | { settings_json: string }
    | undefined;
  return row ? parseJson<Partial<GameSettings> | null>(row.settings_json, null) : null;
}

export function saveUserSettings(userId: string, settings: GameSettings) {
  db.prepare(
    `INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
  ).run(userId, JSON.stringify(settings), Date.now());
}

export function saveContactMessage(entry: {
  kind: "bug" | "idea";
  name: string;
  email: string;
  message: string;
  userId: string | null;
}): string {
  const id = makeId();
  db.prepare(
    `INSERT INTO contact_messages (id, created_at, kind, name, email, message, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, Date.now(), entry.kind, entry.name, entry.email, entry.message, entry.userId);
  return id;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getStatsRow(userId: string) {
  return db.prepare(`SELECT * FROM user_stats WHERE user_id = ?`).get(userId) as
    | Record<string, number | string>
    | undefined;
}

function ensureStats(userId: string) {
  db.prepare(`INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)`).run(userId);
}

export function listAllStats(): Map<string, UserStats> {
  const rows = db.prepare(`SELECT * FROM user_stats`).all() as Record<string, number | string>[];
  const stats = new Map<string, UserStats>();
  for (const row of rows) stats.set(String(row.user_id), rowToStats(row));
  return stats;
}

function rowToStats(row: Record<string, number | string> | undefined): UserStats {
  if (!row) return { ...EMPTY_STATS };
  return {
    gamesPlayed: Number(row.games_played) || 0,
    roundsPlayed: Number(row.rounds_played) || 0,
    wordsFound: Number(row.words_found) || 0,
    uniqueWords: Number(row.unique_words) || 0,
    totalPoints: Number(row.total_points) || 0,
    longestWord: Number(row.longest_word) || 0,
    bestRoundScore: Number(row.best_round_score) || 0,
    bestRoundWords: Number(row.best_round_words) || 0,
    wins: Number(row.wins) || 0,
    soloGames: Number(row.solo_games) || 0,
    multiGames: Number(row.multi_games) || 0,
    hostedGames: Number(row.hosted_games) || 0,
  };
}

function ownedBadgeIds(userId: string): Set<string> {
  const rows = db
    .prepare(`SELECT badge_id FROM user_badges WHERE user_id = ?`)
    .all(userId) as { badge_id: string }[];
  return new Set(rows.map((row) => row.badge_id));
}

function insertBadge(userId: string, badgeId: string, at: number): boolean {
  if (!BADGE_BY_ID.has(badgeId)) return false;
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)`,
    )
    .run(userId, badgeId, at);
  return result.changes > 0;
}

function awardMany(userId: string, ids: string[], at: number): BadgeDef[] {
  const earned: BadgeDef[] = [];
  for (const id of ids) {
    const def = badgePublic(id);
    if (!def) continue;
    if (insertBadge(userId, id, at)) earned.push(def);
  }
  return earned;
}

export function awardWelcome(userId: string): BadgeDef[] {
  ensureStats(userId);
  return awardMany(userId, ["welcome"], Date.now());
}

export function awardLexicographer(userId: string): BadgeDef[] {
  ensureStats(userId);
  db.prepare(`UPDATE user_stats SET dict_adds = dict_adds + 1 WHERE user_id = ?`).run(userId);
  return awardMany(userId, ["lexicographe"], Date.now());
}

type ExtraStats = {
  quWords: number;
  sharedWords: number;
  dictAdds: number;
};

function extraStats(userId: string): ExtraStats {
  const row = getStatsRow(userId);
  return {
    quWords: Number(row?.qu_words) || 0,
    sharedWords: Number(row?.shared_words) || 0,
    dictAdds: Number(row?.dict_adds) || 0,
  };
}

function evaluateBadges(userId: string, stats: UserStats, extra: ExtraStats, round: {
  wordCount: number;
  uniqueCount: number;
  roundScore: number;
  longest: number;
  hasShared: boolean;
  hasQu: boolean;
  emptyHands: boolean;
  roundInGame: number;
}): string[] {
  const have = ownedBadgeIds(userId);
  const next: string[] = [];
  const take = (id: string) => {
    if (!have.has(id)) {
      have.add(id);
      next.push(id);
    }
  };

  take("welcome");
  if (stats.wordsFound >= 1) take("premier-mot");
  if (stats.soloGames >= 1) take("premier-solo");
  if (stats.multiGames >= 1) take("premier-multi");

  for (const n of GAME_THRESHOLDS) if (stats.gamesPlayed >= n) take(`parties-${n}`);
  for (const n of ROUND_WORD_THRESHOLDS) if (round.wordCount >= n) take(`manche-mots-${n}`);
  for (const n of LIFETIME_WORD_THRESHOLDS) if (stats.wordsFound >= n) take(`mots-${n}`);
  for (const n of ROUND_SCORE_THRESHOLDS) if (round.roundScore >= n) take(`manche-pts-${n}`);
  for (const n of WORD_LENGTH_THRESHOLDS) if (round.longest >= n || stats.longestWord >= n) {
    take(`mot-${n}`);
  }
  for (const n of WIN_THRESHOLDS) if (stats.wins >= n) take(`victoire-${n}`);

  if (round.hasShared || extra.sharedWords >= 1) take("partage");
  if (extra.dictAdds >= 1) take("lexicographe");
  if (round.emptyHands) take("mains-vides");
  if (round.hasQu || extra.quWords >= 1) take("qu-maitre");
  if (round.uniqueCount >= 15) take("unique-15");
  if (round.roundInGame >= 5) take("marathon-5");
  if (stats.hostedGames >= 10) take("hote-10");

  for (const n of COLLECTION_THRESHOLDS) {
    if (have.size >= n) take(`collection-${n}`);
  }

  return next;
}

const WINS_SQL = `
  SELECT COUNT(*)
  FROM round_players rp
  JOIN rounds r ON r.id = rp.round_id
  JOIN games g ON g.id = r.game_id
  WHERE rp.user_id = user_stats.user_id
    AND g.solo = 0
    AND r.round = (SELECT MAX(r2.round) FROM rounds r2 WHERE r2.game_id = g.id)
    AND (SELECT COUNT(*) FROM round_players o WHERE o.round_id = r.id) > 1
    AND rp.total_score = (SELECT MAX(o.total_score) FROM round_players o WHERE o.round_id = r.id)
`;

function syncGameWins(gameId: string) {
  db.prepare(
    `UPDATE user_stats SET wins = (${WINS_SQL})
     WHERE user_id IN (
       SELECT DISTINCT rp.user_id FROM round_players rp
       JOIN rounds r ON r.id = rp.round_id
       WHERE r.game_id = ? AND rp.user_id IS NOT NULL
     )`,
  ).run(gameId);
}

function alreadyInGame(gameId: string, userId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok
       FROM rounds r
       JOIN round_players rp ON rp.round_id = r.id
       WHERE r.game_id = ? AND rp.user_id = ?
       LIMIT 1`,
    )
    .get(gameId, userId) as { ok: number } | undefined;
  return Boolean(row);
}

export function recordFinishedRound(snap: RoundSnapshot): {
  gameId: string;
  earned: Map<string, BadgeDef[]>;
} {
  const now = snap.endedAt || Date.now();

  const previewPlayers = [...snap.players]
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name, "fr"))
    .map((p) => ({
      name: p.name,
      color: p.color,
      score: p.totalScore,
      userId: p.userId,
    }));

  let gameId = snap.gameId;
  if (!gameId) {
    gameId = makeId();
    db.prepare(
      `INSERT INTO games (id, code, solo, created_at, updated_at, settings_json, preview_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      gameId,
      snap.code,
      snap.solo ? 1 : 0,
      now,
      now,
      JSON.stringify(snap.settings),
      JSON.stringify({ roundCount: snap.round, players: previewPlayers }),
    );
  } else {
    db.prepare(
      `UPDATE games
       SET updated_at = ?, settings_json = ?, preview_json = ?, solo = ?
       WHERE id = ?`,
    ).run(
      now,
      JSON.stringify(snap.settings),
      JSON.stringify({ roundCount: snap.round, players: previewPlayers }),
      snap.solo ? 1 : 0,
      gameId,
    );
  }

  const roundId = makeId();
  db.prepare(
    `INSERT INTO rounds (id, game_id, round, started_at, ended_at, grid_json, recap_json, summary_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    roundId,
    gameId,
    snap.round,
    snap.startedAt,
    now,
    snap.grid ? JSON.stringify(snap.grid) : null,
    JSON.stringify(snap.recap),
    snap.summary ? JSON.stringify(snap.summary) : null,
  );

  const insertPlayer = db.prepare(
    `INSERT INTO round_players
      (round_id, player_id, user_id, name, color, round_score, total_score, words_json, is_host)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const earned = new Map<string, BadgeDef[]>();
  const firstInGame = new Set(
    snap.players
      .filter((player) => player.userId && !alreadyInGame(gameId, player.userId))
      .map((player) => player.id),
  );

  for (const player of snap.players) {
    insertPlayer.run(
      roundId,
      player.id,
      player.userId,
      player.name,
      player.color,
      player.roundScore,
      player.totalScore,
      JSON.stringify(player.words),
      player.isHost ? 1 : 0,
    );
    if (player.userId) ensureStats(player.userId);
  }
  syncGameWins(gameId);

  for (const player of snap.players) {
    if (!player.userId) continue;
    const first = firstInGame.has(player.id);
    const words = player.words;
    const wordCount = words.length;
    const uniqueCount = words.filter((w) => !w.shared).length;
    const longest = words.reduce((max, w) => Math.max(max, w.letters), 0);
    const hasShared = words.some((w) => w.shared);
    const hasQu = words.some((w) => w.key.includes("QU") || w.display.toUpperCase().includes("QU"));

    db.prepare(
      `UPDATE user_stats SET
        games_played = games_played + ?,
        rounds_played = rounds_played + 1,
        words_found = words_found + ?,
        unique_words = unique_words + ?,
        total_points = total_points + ?,
        longest_word = MAX(longest_word, ?),
        best_round_score = MAX(best_round_score, ?),
        best_round_words = MAX(best_round_words, ?),
        solo_games = solo_games + ?,
        multi_games = multi_games + ?,
        hosted_games = hosted_games + ?,
        qu_words = qu_words + ?,
        shared_words = shared_words + ?
       WHERE user_id = ?`,
    ).run(
      first ? 1 : 0,
      wordCount,
      uniqueCount,
      player.roundScore,
      longest,
      player.roundScore,
      wordCount,
      first && snap.solo ? 1 : 0,
      first && !snap.solo ? 1 : 0,
      first && player.isHost ? 1 : 0,
      hasQu ? 1 : 0,
      hasShared ? 1 : 0,
      player.userId,
    );

    const stats = rowToStats(getStatsRow(player.userId));
    const ids = evaluateBadges(player.userId, stats, extraStats(player.userId), {
      wordCount,
      uniqueCount,
      roundScore: player.roundScore,
      longest,
      hasShared,
      hasQu,
      emptyHands: wordCount === 0,
      roundInGame: snap.round,
    });
    earned.set(player.userId, awardMany(player.userId, ids, now));
  }

  return { gameId, earned };
}

function previewPlayers(
  raw: string,
  youId: string | null,
): HistoryPlayer[] {
  const parsed = parseJson<{ players?: { name: string; color: string; score: number; userId?: string | null }[] }>(
    raw,
    {},
  );
  return (parsed.players ?? []).map((p) => ({
    name: p.name,
    color: p.color,
    score: p.score,
    you: Boolean(youId && p.userId === youId),
  }));
}

export function listGames(userId: string): GameHistoryItem[] {
  const rows = db
    .prepare(
      `SELECT g.id, g.solo, g.created_at, g.updated_at, g.settings_json, g.preview_json
       FROM games g
       WHERE EXISTS (
         SELECT 1 FROM rounds r
         JOIN round_players rp ON rp.round_id = r.id
         WHERE r.game_id = g.id AND rp.user_id = ?
       )
       ORDER BY g.updated_at DESC
       LIMIT 80`,
    )
    .all(userId) as {
    id: string;
    solo: number;
    created_at: number;
    updated_at: number;
    settings_json: string;
    preview_json: string;
  }[];

  return rows.map((row) => {
    const settings = parseJson<GameSettings>(row.settings_json, {
      durationSec: 180,
      minLetters: 4,
      allowPlurals: false,
      allowFeminines: false,
      conjugations: "participles",
      allowPastParticiple: true,
      allowPresentParticiple: true,
      difficulty: "medium",
      letterOrientation: "upright",
    });
    const players = previewPlayers(row.preview_json, userId);
    const preview = parseJson<{ roundCount?: number }>(row.preview_json, {});
    return {
      id: row.id,
      solo: Boolean(row.solo),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      roundCount: preview.roundCount ?? 1,
      difficulty: settings.difficulty,
      yourScore: players.find((p) => p.you)?.score ?? 0,
      players,
    };
  });
}

export function getGame(userId: string, gameId: string): GameHistoryDetail | null {
  const allowed = db
    .prepare(
      `SELECT 1 AS ok FROM rounds r
       JOIN round_players rp ON rp.round_id = r.id
       WHERE r.game_id = ? AND rp.user_id = ?
       LIMIT 1`,
    )
    .get(gameId, userId) as { ok: number } | undefined;
  if (!allowed) return null;

  const game = db
    .prepare(`SELECT id, solo, created_at, settings_json FROM games WHERE id = ?`)
    .get(gameId) as
    | { id: string; solo: number; created_at: number; settings_json: string }
    | undefined;
  if (!game) return null;

  const rounds = db
    .prepare(
      `SELECT id, round, started_at, ended_at, grid_json, recap_json, summary_json
       FROM rounds WHERE game_id = ? ORDER BY round ASC`,
    )
    .all(gameId) as {
    id: string;
    round: number;
    started_at: number | null;
    ended_at: number;
    grid_json: string | null;
    recap_json: string;
    summary_json: string | null;
  }[];

  const playerStmt = db.prepare(
    `SELECT user_id, name, color, total_score FROM round_players WHERE round_id = ?`,
  );

  return {
    id: game.id,
    solo: Boolean(game.solo),
    createdAt: game.created_at,
    settings: parseJson<GameSettings>(game.settings_json, {
      durationSec: 180,
      minLetters: 4,
      allowPlurals: false,
      allowFeminines: false,
      conjugations: "participles",
      allowPastParticiple: true,
      allowPresentParticiple: true,
      difficulty: "medium",
      letterOrientation: "upright",
    }),
    rounds: rounds.map((round) => {
      const people = playerStmt.all(round.id) as {
        user_id: string | null;
        name: string;
        color: string;
        total_score: number;
      }[];
      return {
        round: round.round,
        startedAt: round.started_at,
        endedAt: round.ended_at,
        grid: round.grid_json ? parseJson<Cell[]>(round.grid_json, []) : null,
        recap: parseJson<WordRecap[]>(round.recap_json, []),
        summary: round.summary_json ? parseJson<RoundSummary>(round.summary_json, {
          unique: [],
          shared: [],
          rejected: [],
          missed: [],
          possibleCount: 0,
        }) : null,
        players: people.map((p) => ({
          name: p.name,
          color: p.color,
          score: p.total_score,
          you: p.user_id === userId,
        })),
      };
    }),
  };
}

export function getProfile(userId: string): ProfilePayload {
  awardWelcome(userId);
  return readProfile(userId);
}

export function readProfile(userId: string): ProfilePayload {
  const stats = rowToStats(getStatsRow(userId));
  const owned = db
    .prepare(`SELECT badge_id, earned_at FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC`)
    .all(userId) as { badge_id: string; earned_at: number }[];
  const atById = new Map(owned.map((row) => [row.badge_id, row.earned_at]));
  const badges: BadgeView[] = BADGES.map((badge) => ({
    ...badge,
    earned: atById.has(badge.id),
    earnedAt: atById.get(badge.id) ?? null,
  }));
  const recentUnlocks = owned
    .slice(0, 6)
    .map((row) => badgePublic(row.badge_id))
    .filter((badge): badge is BadgeDef => Boolean(badge));
  return {
    stats,
    modes: getStatsByMode(userId),
    wordStats: getWordStats(userId),
    wordStatsByMode: { solo: getWordStats(userId, true), multi: getWordStats(userId, false) },
    badges,
    games: listGames(userId),
    recentUnlocks,
  };
}

function emptyModeStats(): ModeStats {
  return {
    games: 0,
    rounds: 0,
    words: 0,
    uniqueWords: 0,
    points: 0,
    averageRoundScore: 0,
    bestRoundScore: 0,
    bestRoundWords: 0,
    longestWord: 0,
    wins: 0,
  };
}

export function getStatsByMode(userId: string): StatsByMode {
  const rows = db
    .prepare(
      `SELECT g.id AS game_id, g.solo, r.round, rp.round_score, rp.total_score, rp.words_json,
         (SELECT MAX(r2.round) FROM rounds r2 WHERE r2.game_id = g.id) AS last_round,
         (SELECT MAX(o.total_score) FROM round_players o WHERE o.round_id = r.id) AS top_score,
         (SELECT COUNT(*) FROM round_players o WHERE o.round_id = r.id) AS seats
       FROM round_players rp
       JOIN rounds r ON r.id = rp.round_id
       JOIN games g ON g.id = r.game_id
       WHERE rp.user_id = ?`,
    )
    .all(userId) as {
    game_id: string;
    solo: number;
    round: number;
    round_score: number;
    total_score: number;
    words_json: string;
    last_round: number;
    top_score: number;
    seats: number;
  }[];

  const modes: StatsByMode = { solo: emptyModeStats(), multi: emptyModeStats() };
  const games = { solo: new Set<string>(), multi: new Set<string>() };

  for (const row of rows) {
    const mode = row.solo ? "solo" : "multi";
    const stats = modes[mode];
    const words = parseJson<FoundWord[]>(row.words_json, []);
    games[mode].add(row.game_id);
    stats.rounds += 1;
    stats.words += words.length;
    stats.uniqueWords += words.filter((word) => !word.shared).length;
    stats.points += row.round_score;
    stats.bestRoundScore = Math.max(stats.bestRoundScore, row.round_score);
    stats.bestRoundWords = Math.max(stats.bestRoundWords, words.length);
    for (const word of words) stats.longestWord = Math.max(stats.longestWord, word.letters);
    const finalRound = row.round === row.last_round;
    if (mode === "multi" && finalRound && row.seats > 1 && row.total_score === row.top_score) {
      stats.wins += 1;
    }
  }

  for (const mode of ["solo", "multi"] as const) {
    const stats = modes[mode];
    stats.games = games[mode].size;
    stats.averageRoundScore = stats.rounds === 0 ? 0 : Math.round((stats.points / stats.rounds) * 10) / 10;
  }
  return modes;
}

export function listModeStats(): Map<string, { solo: DirectoryModeStats; multi: DirectoryModeStats }> {
  const rows = db
    .prepare(
      `SELECT rp.user_id, g.solo,
         COUNT(DISTINCT g.id) AS games,
         COALESCE(SUM(json_array_length(rp.words_json)), 0) AS words,
         COALESCE(SUM(rp.round_score), 0) AS points,
         SUM(
           g.solo = 0
           AND r.round = (SELECT MAX(r2.round) FROM rounds r2 WHERE r2.game_id = g.id)
           AND (SELECT COUNT(*) FROM round_players o WHERE o.round_id = r.id) > 1
           AND rp.total_score = (SELECT MAX(o.total_score) FROM round_players o WHERE o.round_id = r.id)
         ) AS wins
       FROM round_players rp
       JOIN rounds r ON r.id = rp.round_id
       JOIN games g ON g.id = r.game_id
       WHERE rp.user_id IS NOT NULL
       GROUP BY rp.user_id, g.solo`,
    )
    .all() as { user_id: string; solo: number; games: number; words: number; points: number; wins: number }[];

  const empty = (): DirectoryModeStats => ({ games: 0, words: 0, points: 0, wins: 0 });
  const byUser = new Map<string, { solo: DirectoryModeStats; multi: DirectoryModeStats }>();
  for (const row of rows) {
    let entry = byUser.get(row.user_id);
    if (!entry) {
      entry = { solo: empty(), multi: empty() };
      byUser.set(row.user_id, entry);
    }
    entry[row.solo ? "solo" : "multi"] = {
      games: row.games,
      words: row.words,
      points: row.points,
      wins: row.wins,
    };
  }
  return byUser;
}

function wordInitial(word: FoundWord): string {
  const key = word.key.toUpperCase();
  if (key.startsWith("QU")) return "Q";
  return key.slice(0, 1) || "?";
}

function toFreq(key: string, entry: Omit<WordFreq, "key">): WordFreq {
  return { key, ...entry };
}

export function getWordStats(userId: string, solo?: boolean): WordStatsPayload {
  const rows = (
    solo === undefined
      ? db.prepare(`SELECT words_json FROM round_players WHERE user_id = ?`).all(userId)
      : db
          .prepare(
            `SELECT rp.words_json
             FROM round_players rp
             JOIN rounds r ON r.id = rp.round_id
             JOIN games g ON g.id = r.game_id
             WHERE rp.user_id = ? AND g.solo = ?`,
          )
          .all(userId, solo ? 1 : 0)
  ) as { words_json: string }[];

  const byKey = new Map<string, Omit<WordFreq, "key">>();
  const lengthMap = new Map<number, LengthBucket>();
  const initialMap = new Map<string, number>();
  let total = 0;
  let totalLetters = 0;
  let quCount = 0;
  let sharedCount = 0;
  let uniqueCount = 0;

  for (const row of rows) {
    const words = parseJson<FoundWord[]>(row.words_json, []);
    for (const word of words) {
      total += 1;
      totalLetters += word.letters;
      if (word.shared) sharedCount += 1;
      else uniqueCount += 1;
      if (word.key.includes("QU") || word.display.toUpperCase().includes("QU")) quCount += 1;

      const prev = byKey.get(word.key);
      if (prev) {
        prev.count += 1;
        prev.points += word.points;
        prev.sharedCount += word.shared ? 1 : 0;
      } else {
        byKey.set(word.key, {
          display: word.display,
          count: 1,
          points: word.points,
          letters: word.letters,
          sharedCount: word.shared ? 1 : 0,
        });
      }

      const length = lengthMap.get(word.letters) ?? { length: word.letters, count: 0, points: 0 };
      length.count += 1;
      length.points += word.points;
      lengthMap.set(word.letters, length);

      const letter = wordInitial(word);
      initialMap.set(letter, (initialMap.get(letter) ?? 0) + 1);
    }
  }

  const freqs: WordFreq[] = [...byKey.entries()].map(([key, entry]) => toFreq(key, entry));
  const byCount = (a: WordFreq, b: WordFreq) =>
    b.count - a.count || b.letters - a.letters || a.display.localeCompare(b.display, "fr");

  const minLen = 3;
  const maxLen = Math.max(16, ...lengthMap.keys(), minLen);
  const byLength: LengthBucket[] = [];
  for (let n = minLen; n <= maxLen; n++) {
    byLength.push(lengthMap.get(n) ?? { length: n, count: 0, points: 0 });
  }

  const byInitial: LetterBucket[] = [...initialMap.entries()]
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => b.count - a.count || a.letter.localeCompare(b.letter, "fr"));

  return {
    total,
    distinct: freqs.length,
    averageLength: total === 0 ? 0 : Math.round((totalLetters / total) * 10) / 10,
    quCount,
    sharedCount,
    uniqueCount,
    mostFrequent: [...freqs].filter((word) => word.count > 1).sort(byCount).slice(0, 20),
    longest: [...freqs]
      .sort((a, b) => b.letters - a.letters || b.count - a.count || a.display.localeCompare(b.display, "fr"))
      .slice(0, 12),
    richest: [...freqs]
      .sort((a, b) => b.points - a.points || b.letters - a.letters || a.display.localeCompare(b.display, "fr"))
      .slice(0, 12),
    byLength,
    byInitial,
  };
}
