import { randomBytes } from "node:crypto";
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  REROLL_WINDOW_MS,
  foldPlayerName,
  type Cell,
  type FoundWord,
  type GameSettings,
  type Phase,
  type PlayerPublic,
  type RerollView,
  type RejectedWord,
  type PossibleWord,
  type RoundSummary,
  type LobbyRoom,
  type RoomView,
  type SharedWord,
  type WordRecap,
  type WordSubmitResult,
} from "../shared/types.ts";
import { isValidPath, pathToWord, wordPoints } from "../shared/dice.ts";
import { addCustomWord, lookupWord } from "./dictionary.ts";
import { findAllWords, rollPlayableGrid } from "./solver.ts";

type Player = {
  id: string;
  name: string;
  color: string;
  socketId: string | null;
  words: FoundWord[];
  roundScore: number;
  totalScore: number;
};

type RejectedAttempt = {
  display: string;
  letters: number;
  playerIds: Set<string>;
  added: boolean;
};

type Room = {
  code: string;
  hostId: string;
  /** Hidden from the public lobby list (partie solo). */
  solo: boolean;
  phase: Phase;
  round: number;
  settings: GameSettings;
  players: Player[];
  grid: Cell[] | null;
  startedAt: number | null;
  endsAt: number | null;
  /** normalized key → player ids who found it this round */
  foundBy: Map<string, Set<string>>;
  rejected: Map<string, RejectedAttempt>;
  missed: PossibleWord[];
  possibleWords: PossibleWord[];
  possibleCount: number;
  timer: ReturnType<typeof setTimeout> | null;
  rerollVotes: Set<string>;
  rerollWindowTimer: ReturnType<typeof setTimeout> | null;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const rooms = new Map<string, Room>();
const socketRoom = new Map<string, string>();

function makeCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = randomBytes(4);
    let code = "";
    for (let i = 0; i < 4; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    if (!rooms.has(code)) return code;
  }
  throw new Error("Unable to allocate room code");
}

function makeId(): string {
  return randomBytes(8).toString("hex");
}

function sanitizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, 16);
  return name || "Joueur";
}

function clampSettings(input: Partial<GameSettings> | undefined): GameSettings {
  const base = { ...DEFAULT_SETTINGS, ...input };
  const durationSec = Math.min(300, Math.max(30, Math.round(base.durationSec / 15) * 15));
  const minLetters = Math.min(6, Math.max(2, Math.round(base.minLetters)));
  const conjugations = base.conjugations === "participles" ? "participles" : "all";
  let allowPast = Boolean(base.allowPastParticiple);
  let allowPresent = Boolean(base.allowPresentParticiple);
  if (conjugations === "participles" && !allowPast && !allowPresent) {
    allowPast = true;
  }
  const difficulty: GameSettings["difficulty"] =
    base.difficulty === "very-easy" ||
    base.difficulty === "easy" ||
    base.difficulty === "hard"
      ? base.difficulty
      : "medium";
  return {
    durationSec,
    minLetters,
    allowPlurals: Boolean(base.allowPlurals),
    allowFeminines: Boolean(base.allowFeminines),
    conjugations,
    allowPastParticiple: allowPast,
    allowPresentParticiple: allowPresent,
    difficulty,
    letterOrientation: base.letterOrientation === "shuffle" ? "shuffle" : "upright",
  };
}

function publicPlayer(p: Player): PlayerPublic {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    connected: p.socketId !== null,
    roundScore: p.roundScore,
    totalScore: p.totalScore,
    wordCount: p.words.length,
  };
}

function recap(room: Room): WordRecap[] | null {
  if (room.phase !== "results") return null;
  return room.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    color: p.color,
    words: p.words,
    roundScore: p.roundScore,
  }));
}

function roundSummary(room: Room): RoundSummary | null {
  if (room.phase !== "results") return null;
  const unique: RoundSummary["unique"] = [];
  const shared: SharedWord[] = [];
  for (const [key, owners] of room.foundBy) {
    const sample = room.players.flatMap((p) => p.words.filter((w) => w.key === key))[0];
    if (!sample) continue;
    const people = room.players.filter((p) => owners.has(p.id));
    if (owners.size <= 1) {
      const p = people[0];
      if (!p) continue;
      unique.push({
        key,
        display: sample.display,
        letters: sample.letters,
        points: sample.points,
        playerId: p.id,
        name: p.name,
        color: p.color,
      });
    } else {
      shared.push({
        key,
        display: sample.display,
        letters: sample.letters,
        names: people.map((p) => ({ name: p.name, color: p.color })),
      });
    }
  }
  unique.sort((a, b) => b.points - a.points || b.letters - a.letters);
  shared.sort((a, b) => b.letters - a.letters);
  const rejected: RejectedWord[] = [...room.rejected.entries()]
    .map(([key, attempt]) => ({
      key,
      display: attempt.display,
      letters: attempt.letters,
      added: attempt.added,
      names: room.players
        .filter((p) => attempt.playerIds.has(p.id))
        .map((p) => ({ name: p.name, color: p.color })),
    }))
    .sort((a, b) => b.letters - a.letters || a.display.localeCompare(b.display, "fr"));
  return {
    unique,
    shared,
    rejected,
    missed: room.missed,
    possibleCount: room.possibleCount,
  };
}

function isSolo(room: Room) {
  return room.players.length === 1;
}

function rerollWindowOpen(room: Room) {
  if (!room.startedAt) return false;
  return Date.now() - room.startedAt < REROLL_WINDOW_MS;
}

function rerollView(room: Room, playerId: string): RerollView | null {
  if (room.phase !== "playing") return null;
  const solo = isSolo(room);
  const open = solo || rerollWindowOpen(room);
  return {
    solo,
    canVote: open,
    youVoted: room.rerollVotes.has(playerId),
    voterIds: [...room.rerollVotes],
    needed: room.players.length,
    windowEndsAt: solo || !room.startedAt ? null : room.startedAt + REROLL_WINDOW_MS,
  };
}

export function viewFor(room: Room, playerId: string): RoomView {
  const you = room.players.find((p) => p.id === playerId);
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    round: room.round,
    settings: room.settings,
    players: room.players.map(publicPlayer),
    grid: room.grid,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    you: {
      id: playerId,
      words: you?.words ?? [],
    },
    recap: recap(room),
    summary: roundSummary(room),
    reroll: rerollView(room, playerId),
  };
}

export function getRoomBySocket(socketId: string): Room | undefined {
  const code = socketRoom.get(socketId);
  return code ? rooms.get(code) : undefined;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

type Broadcast = (room: Room, event: string, payload?: unknown) => void;
type LobbyBroadcast = (rooms: LobbyRoom[]) => void;

let broadcast: Broadcast = () => {};
let lobbyBroadcast: LobbyBroadcast = () => {};

export function setBroadcast(fn: Broadcast) {
  broadcast = fn;
}

export function setLobbyBroadcast(fn: LobbyBroadcast) {
  lobbyBroadcast = fn;
}

export function listPublicRooms(): LobbyRoom[] {
  return [...rooms.values()]
    .filter((room) => !room.solo)
    .map((room) => ({
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      playerCount: room.players.length,
      difficulty: room.settings.difficulty,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isHost: p.id === room.hostId,
        totalScore: p.totalScore,
        roundScore: p.roundScore,
      })),
    }));
}

function notifyLobby() {
  lobbyBroadcast(listPublicRooms());
}

function emitState(room: Room) {
  broadcast(room, "room:state");
  notifyLobby();
}

function nextColor(room: Room): string {
  const used = new Set(room.players.map((p) => p.color));
  return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
}

function clearTimer(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function clearRerollTimer(room: Room) {
  if (room.rerollWindowTimer) {
    clearTimeout(room.rerollWindowTimer);
    room.rerollWindowTimer = null;
  }
}

function finishRound(room: Room) {
  clearTimer(room);
  clearRerollTimer(room);
  if (room.phase !== "playing") return;
  room.phase = "results";
  room.endsAt = Date.now();
  for (const player of room.players) {
    player.totalScore += player.roundScore;
  }
  const all =
    room.possibleWords.length > 0
      ? room.possibleWords
      : room.grid
        ? findAllWords(room.grid, room.settings)
        : [];
  room.possibleCount = all.length;
  room.missed = all.filter((word) => !room.foundBy.has(word.key));
  emitState(room);
  if (room.players.every((p) => p.socketId === null)) {
    rooms.delete(room.code);
    notifyLobby();
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase === "playing" && room.endsAt && Date.now() >= room.endsAt) {
      finishRound(room);
    }
  }
}, 200);

export function createRoom(socketId: string, name: string, solo = false) {
  const code = makeCode();
  const player: Player = {
    id: makeId(),
    name: sanitizeName(name),
    color: PLAYER_COLORS[0],
    socketId,
    words: [],
    roundScore: 0,
    totalScore: 0,
  };
  const room: Room = {
    code,
    hostId: player.id,
    solo,
    phase: "lobby",
    round: 0,
    settings: { ...DEFAULT_SETTINGS },
    players: [player],
    grid: null,
    startedAt: null,
    endsAt: null,
    foundBy: new Map(),
    rejected: new Map(),
    missed: [],
    possibleWords: [],
    possibleCount: 0,
    timer: null,
    rerollVotes: new Set(),
    rerollWindowTimer: null,
  };
  rooms.set(code, room);
  socketRoom.set(socketId, code);
  notifyLobby();
  return { room, playerId: player.id };
}

export function joinRoom(socketId: string, code: string, name: string) {
  const room = rooms.get(code.trim().toUpperCase());
  if (!room) return { error: "Salon introuvable" as const };
  if (room.players.length >= MAX_PLAYERS) {
    return { error: "Ce salon est complet (10 joueurs)" as const };
  }
  const playerName = sanitizeName(name);
  if (room.players.some((p) => foldPlayerName(p.name) === foldPlayerName(playerName))) {
    return { error: "Ce prénom est déjà pris dans ce salon" as const };
  }
  const player: Player = {
    id: makeId(),
    name: playerName,
    color: nextColor(room),
    socketId,
    words: [],
    roundScore: 0,
    totalScore: 0,
  };
  room.players.push(player);
  socketRoom.set(socketId, room.code);
  emitState(room);
  return { room, playerId: player.id };
}

export function rejoinRoom(socketId: string, code: string, playerId: string) {
  const room = rooms.get(code.trim().toUpperCase());
  if (!room) return { error: "Salon introuvable" as const };
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "Joueur introuvable" as const };
  if (player.socketId && player.socketId !== socketId) {
    socketRoom.delete(player.socketId);
  }
  player.socketId = socketId;
  socketRoom.set(socketId, room.code);
  emitState(room);
  return { room, playerId: player.id };
}

function removePlayer(room: Room, player: Player) {
  room.players = room.players.filter((p) => p.id !== player.id);
  room.rerollVotes.delete(player.id);
  if (room.players.length === 0) {
    clearTimer(room);
    clearRerollTimer(room);
    rooms.delete(room.code);
    notifyLobby();
    return;
  }
  if (room.hostId === player.id) {
    room.hostId = room.players[0].id;
  }
  emitState(room);
}

export function leaveSocket(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const player = room.players.find((p) => p.socketId === socketId);
  socketRoom.delete(socketId);
  if (!player) return;

  if (room.phase === "playing") {
    player.socketId = null;
    emitState(room);
    return;
  }

  removePlayer(room, player);
}

/** Intentional quit: leave the table even mid-round. */
export function leaveRoom(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const player = room.players.find((p) => p.socketId === socketId);
  socketRoom.delete(socketId);
  if (!player) return;
  removePlayer(room, player);
}

export function updateSettings(socketId: string, settings: Partial<GameSettings>) {
  const room = getRoomBySocket(socketId);
  if (!room) return { error: "Pas dans un salon" as const };
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.id !== room.hostId) {
    return { error: "Seul l'hôte peut changer les règles" as const };
  }
  if (room.phase === "playing") {
    return { error: "Impossible de changer les règles en cours de manche" as const };
  }
  room.settings = clampSettings(settings);
  emitState(room);
  return { ok: true as const };
}

function beginRound(room: Room, incrementRound: boolean) {
  clearTimer(room);
  clearRerollTimer(room);
  room.phase = "playing";
  if (incrementRound) room.round += 1;
  const dealt = rollPlayableGrid(room.settings);
  room.grid = dealt.grid;
  room.possibleWords = dealt.words;
  room.possibleCount = dealt.words.length;
  room.foundBy = new Map();
  room.rejected = new Map();
  room.missed = [];
  room.rerollVotes = new Set();
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + room.settings.durationSec * 1000;
  for (const p of room.players) {
    p.words = [];
    p.roundScore = 0;
  }
  room.timer = setTimeout(
    () => finishRound(room),
    room.settings.durationSec * 1000 + 50,
  );
  if (!isSolo(room)) {
    room.rerollWindowTimer = setTimeout(() => {
      room.rerollVotes = new Set();
      room.rerollWindowTimer = null;
      if (room.phase === "playing") emitState(room);
    }, REROLL_WINDOW_MS);
  }
  emitState(room);
}

export function startGame(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room) return { error: "Pas dans un salon" as const };
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.id !== room.hostId) {
    return { error: "Seul l'hôte peut lancer la manche" as const };
  }
  if (room.phase === "playing") {
    return { error: "La manche est déjà lancée" as const };
  }
  beginRound(room, true);
  return { ok: true as const };
}

export function voteReroll(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room || room.phase !== "playing") {
    return { error: "Pas de manche en cours" as const };
  }
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return { error: "Pas dans un salon" as const };

  if (isSolo(room)) {
    beginRound(room, false);
    return { ok: true as const };
  }

  if (!rerollWindowOpen(room)) {
    return { error: "Trop tard : seulement les 15 premières secondes" as const };
  }

  room.rerollVotes.add(player.id);
  const unanimous = room.players.every((p) => room.rerollVotes.has(p.id));
  if (unanimous) {
    beginRound(room, false);
    return { ok: true as const };
  }
  emitState(room);
  return { ok: true as const };
}

export function submitWord(socketId: string, cells: number[]): WordSubmitResult {
  const room = getRoomBySocket(socketId);
  if (!room || room.phase !== "playing" || !room.grid) {
    return { ok: false, reason: "phase" };
  }
  if (room.endsAt && Date.now() >= room.endsAt) {
    finishRound(room);
    return { ok: false, reason: "phase" };
  }
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return { ok: false, reason: "phase" };
  if (!Array.isArray(cells) || !isValidPath(cells)) {
    return { ok: false, reason: "path" };
  }

  const built = pathToWord(room.grid, cells);
  if (built.letters < room.settings.minLetters) {
    return { ok: false, reason: "too-short" };
  }

  const found = lookupWord(built.key, room.settings);
  if (!found.ok) {
    if (found.reason === "unknown") {
      const prev = room.rejected.get(built.key);
      if (prev) prev.playerIds.add(player.id);
      else {
        room.rejected.set(built.key, {
          display: built.display.toLowerCase(),
          letters: built.letters,
          playerIds: new Set([player.id]),
          added: false,
        });
      }
    }
    return { ok: false, reason: found.reason };
  }

  if (player.words.some((w) => w.key === built.key)) {
    return { ok: false, reason: "duplicate" };
  }

  let owners = room.foundBy.get(built.key);
  if (!owners) {
    owners = new Set();
    room.foundBy.set(built.key, owners);
  }
  owners.add(player.id);
  const shared = owners.size > 1;

  const word: FoundWord = {
    key: built.key,
    display: found.display,
    letters: built.letters,
    points: wordPoints(built.letters, shared),
    shared,
  };
  player.words.unshift(word);
  player.roundScore = player.words.reduce((sum, w) => sum + w.points, 0);

  if (shared) {
    for (const other of room.players) {
      let changed = false;
      for (const w of other.words) {
        if (w.key === built.key && !w.shared) {
          w.shared = true;
          w.points = 0;
          changed = true;
        }
      }
      if (changed) {
        other.roundScore = other.words.reduce((sum, w) => sum + w.points, 0);
      }
    }
    broadcast(room, "word:shared", { key: built.key });
  }

  emitState(room);
  return { ok: true, word, shared };
}

function setRoundScore(player: Player, next: number) {
  player.totalScore += next - player.roundScore;
  player.roundScore = next;
}

export function adoptRejectedWord(socketId: string, key: string) {
  const room = getRoomBySocket(socketId);
  if (!room) return { error: "Pas dans un salon" as const };
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return { error: "Pas dans un salon" as const };
  if (room.phase !== "results") {
    return { error: "Ajout possible à la fin de la manche" as const };
  }
  const k = key.toUpperCase();
  const attempt = room.rejected.get(k);
  if (!attempt) return { error: "Mot introuvable dans les refusés" as const };
  if (attempt.added) return { ok: true as const };

  addCustomWord(k, attempt.display);
  const found = lookupWord(k, room.settings);
  if (!found.ok) return { error: "Impossible d'ajouter ce mot" as const };

  const owners = attempt.playerIds;
  const shared = owners.size > 1;
  const word: FoundWord = {
    key: k,
    display: found.display,
    letters: attempt.letters,
    points: wordPoints(attempt.letters, shared),
    shared,
  };

  room.foundBy.set(k, new Set(owners));
  for (const p of room.players) {
    if (!owners.has(p.id)) continue;
    if (p.words.some((w) => w.key === k)) continue;
    p.words.unshift({ ...word });
    setRoundScore(
      p,
      p.words.reduce((sum, w) => sum + w.points, 0),
    );
  }

  if (!room.possibleWords.some((w) => w.key === k)) {
    room.possibleWords.push({
      key: k,
      display: found.display,
      letters: attempt.letters,
      points: wordPoints(attempt.letters, false),
    });
  }
  room.possibleCount = room.possibleWords.length;
  attempt.added = true;
  emitState(room);
  return { ok: true as const };
}

