import { randomBytes } from "node:crypto";
import type { BadgeDef } from "../shared/badges.ts";
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  REROLL_WINDOW_MS,
  foldPlayerName,
  type Cell,
  type ChatMessage,
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
import { awardLexicographer, recordFinishedRound, type RoundSnapshot } from "./store.ts";

type Player = {
  id: string;
  name: string;
  color: string;
  socketId: string | null;
  disconnectedAt: number | null;
  userId: string | null;
  words: FoundWord[];
  roundScore: number;
  totalScore: number;
  earnedBadges: BadgeDef[];
  lastChatAt: number | null;
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
  persistedId: string | null;
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
  chat: ChatMessage[];
  likes: Map<string, Set<string>>;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Keep a seat after a drop so a page refresh can rejoin; then reap the room. */
export const DISCONNECT_GRACE_MS = 30_000;
const rooms = new Map<string, Room>();
const socketRoom = new Map<string, string>();

function isConnected(player: Player) {
  return player.socketId !== null;
}

function hasConnectedPlayers(room: Room) {
  return room.players.some(isConnected);
}

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
        likedBy: likesFor(room, key),
      });
    } else {
      shared.push({
        key,
        display: sample.display,
        letters: sample.letters,
        names: people.map((p) => ({ name: p.name, color: p.color })),
        playerIds: people.map((p) => p.id),
        likedBy: likesFor(room, key),
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

function likesFor(room: Room, key: string) {
  return [...(room.likes.get(key) ?? [])]
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .map((p) => ({ playerId: p.id, name: p.name, color: p.color }));
}

const CHAT_MAX = 200;

function pushChat(room: Room, message: Omit<ChatMessage, "id" | "at">) {
  room.chat.push({
    ...message,
    id: makeId(),
    at: Date.now(),
  });
  if (room.chat.length > CHAT_MAX) {
    room.chat.splice(0, room.chat.length - CHAT_MAX);
  }
}

function announceBadge(room: Room, player: Player, badge: BadgeDef) {
  pushChat(room, {
    kind: "badge",
    playerId: player.id,
    name: player.name,
    color: player.color,
    badge,
  });
}

function announceResultsChat(room: Room) {
  const ranked = [...room.players].sort(
    (a, b) => b.roundScore - a.roundScore || b.totalScore - a.totalScore,
  );
  const winner = ranked[0];
  if (winner && room.players.length > 1) {
    pushChat(room, {
      kind: "system",
      playerId: null,
      name: "",
      color: "#e8b84a",
      text: `${winner.name} remporte la manche ${room.round} · ${winner.roundScore} pt${winner.roundScore > 1 ? "s" : ""}`,
    });
  } else if (winner) {
    pushChat(room, {
      kind: "system",
      playerId: null,
      name: "",
      color: "#e8b84a",
      text: `Manche ${room.round} terminée · ${winner.roundScore} pt${winner.roundScore > 1 ? "s" : ""}`,
    });
  }
  for (const player of room.players) {
    for (const badge of player.earnedBadges) {
      announceBadge(room, player, badge);
    }
  }
}

function sanitizeChat(raw: string) {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

export function sendChat(socketId: string, text: string) {
  const room = getRoomBySocket(socketId);
  if (!room || room.phase !== "results") {
    return { error: "Le chat s’ouvre à la synthèse de manche" as const };
  }
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return { error: "Pas dans un salon" as const };
  const now = Date.now();
  if (player.lastChatAt && now - player.lastChatAt < 400) {
    return { error: "Doucement…" as const };
  }
  const clean = sanitizeChat(text);
  if (!clean) return { error: "Message vide" as const };
  player.lastChatAt = now;
  pushChat(room, {
    kind: "text",
    playerId: player.id,
    name: player.name,
    color: player.color,
    text: clean,
  });
  emitState(room);
  return { ok: true as const };
}

export function toggleWordLike(socketId: string, key: string) {
  const room = getRoomBySocket(socketId);
  if (!room || room.phase !== "results") {
    return { error: "Les likes s’ouvrent à la synthèse" as const };
  }
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return { error: "Pas dans un salon" as const };
  const folded = key.trim().toUpperCase();
  const owners = room.foundBy.get(folded);
  if (!owners || owners.size === 0) {
    return { error: "Mot introuvable" as const };
  }
  if (owners.has(player.id)) {
    return { error: "Tu ne peux pas liker un mot que tu as trouvé" as const };
  }
  const people = room.players.filter((p) => owners.has(p.id));
  const sample = people.flatMap((p) => p.words.filter((w) => w.key === folded))[0];
  const first = people[0];
  if (!first || !sample) return { error: "Mot introuvable" as const };

  const likers = room.likes.get(folded) ?? new Set<string>();
  if (likers.has(player.id)) {
    likers.delete(player.id);
    room.chat = room.chat.filter(
      (message) =>
        !(message.kind === "like" && message.playerId === player.id && message.word?.key === folded),
    );
  } else {
    likers.add(player.id);
    pushChat(room, {
      kind: "like",
      playerId: player.id,
      name: player.name,
      color: player.color,
      word: {
        key: folded,
        display: sample.display,
        ownerId: first.id,
        ownerName: people.map((p) => p.name).join(" et "),
        ownerColor: first.color,
      },
    });
  }
  room.likes.set(folded, likers);
  emitState(room);
  return { ok: true as const };
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
    needed: Math.max(1, room.players.filter(isConnected).length),
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
      earnedBadges: you?.earnedBadges ?? [],
    },
    recap: recap(room),
    summary: roundSummary(room),
    reroll: rerollView(room, playerId),
    chat: room.chat ?? [],
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
    .filter((room) => !room.solo && hasConnectedPlayers(room))
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
        connected: isConnected(p),
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
  persistRound(room);
  announceResultsChat(room);
  emitState(room);
}

function destroyRoom(room: Room) {
  clearTimer(room);
  clearRerollTimer(room);
  for (const player of room.players) {
    if (player.socketId) socketRoom.delete(player.socketId);
  }
  rooms.delete(room.code);
  notifyLobby();
}

export function closeRoom(code: string) {
  const room = getRoom(code.trim());
  if (!room) return { error: "Salon introuvable" as const };
  const socketIds = room.players
    .map((player) => player.socketId)
    .filter((id): id is string => Boolean(id));
  destroyRoom(room);
  return { socketIds };
}

function gameInProgress(room: Room) {
  return room.phase === "playing" || room.phase === "results";
}

function isAbandoned(player: Player, now: number) {
  return (
    !isConnected(player) &&
    player.disconnectedAt !== null &&
    now - player.disconnectedAt >= DISCONNECT_GRACE_MS
  );
}

function reapStalePlayers(now: number) {
  for (const room of [...rooms.values()]) {
    const stale = room.players.filter((player) => isAbandoned(player, now));
    if (stale.length === 0) continue;
    if (stale.length === room.players.length) {
      destroyRoom(room);
      continue;
    }
    if (gameInProgress(room)) continue;
    for (const player of stale) {
      if (!rooms.has(room.code)) break;
      removePlayer(room, player);
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    if (room.phase === "playing" && room.endsAt && now >= room.endsAt) {
      finishRound(room);
    }
  }
  reapStalePlayers(now);
}, 200);

function persistRound(room: Room) {
  if (!room.players.some((p) => p.userId)) return;
  const snap: RoundSnapshot = {
    gameId: room.persistedId,
    code: room.code,
    solo: room.solo || isSolo(room),
    round: room.round,
    settings: room.settings,
    grid: room.grid,
    startedAt: room.startedAt,
    endedAt: room.endsAt ?? Date.now(),
    recap: recap(room) ?? [],
    summary: roundSummary(room),
    players: room.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      color: p.color,
      roundScore: p.roundScore,
      totalScore: p.totalScore,
      words: p.words,
      isHost: p.id === room.hostId,
    })),
  };
  const result = recordFinishedRound(snap);
  room.persistedId = result.gameId;
  for (const player of room.players) {
    player.earnedBadges = player.userId ? (result.earned.get(player.userId) ?? []) : [];
  }
}

function evacuateUser(userId: string, exceptCode?: string): string[] {
  const kicked: string[] = [];
  for (const room of [...rooms.values()]) {
    if (exceptCode && room.code === exceptCode) continue;
    const player = room.players.find((p) => p.userId === userId);
    if (!player) continue;
    if (player.socketId) {
      kicked.push(player.socketId);
      socketRoom.delete(player.socketId);
    }
    removePlayer(room, player);
  }
  return kicked;
}

function claimSeat(room: Room, player: Player, socketId: string): string | null {
  const previous = player.socketId && player.socketId !== socketId ? player.socketId : null;
  if (previous) socketRoom.delete(previous);
  player.socketId = socketId;
  player.disconnectedAt = null;
  socketRoom.set(socketId, room.code);
  return previous;
}

function claimDisconnectedName(
  room: Room,
  socketId: string,
  playerName: string,
  userId: string | null,
) {
  const existing = room.players.find(
    (p) => !isConnected(p) && foldPlayerName(p.name) === foldPlayerName(playerName),
  );
  if (!existing) return null;
  if (existing.userId && userId && existing.userId !== userId) return null;
  if (userId && !existing.userId) existing.userId = userId;
  const extra = userId ? evacuateUser(userId, room.code) : [];
  const replaced = claimSeat(room, existing, socketId);
  emitState(room);
  return {
    room,
    playerId: existing.id,
    replacedSocketIds: [...extra, ...(replaced ? [replaced] : [])],
  };
}

function makePlayer(
  socketId: string,
  name: string,
  color: string,
  userId: string | null,
): Player {
  return {
    id: makeId(),
    name,
    color,
    socketId,
    disconnectedAt: null,
    userId,
    words: [],
    roundScore: 0,
    totalScore: 0,
    earnedBadges: [],
    lastChatAt: null,
  };
}

function abandonCurrentSeat(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const player = room.players.find((p) => p.socketId === socketId);
  socketRoom.delete(socketId);
  if (player) removePlayer(room, player);
}

export function createRoom(socketId: string, name: string, solo = false, userId: string | null = null) {
  abandonCurrentSeat(socketId);
  const replacedSocketIds = userId ? evacuateUser(userId) : [];
  const code = makeCode();
  const player = makePlayer(socketId, sanitizeName(name), PLAYER_COLORS[0], userId);
  const room: Room = {
    code,
    hostId: player.id,
    persistedId: null,
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
    chat: [],
    likes: new Map(),
  };
  rooms.set(code, room);
  socketRoom.set(socketId, code);
  notifyLobby();
  return { room, playerId: player.id, replacedSocketIds };
}

export function joinRoom(socketId: string, code: string, name: string, userId: string | null = null) {
  const room = rooms.get(code.trim().toUpperCase());
  if (!room) return { error: "Salon introuvable" as const };
  if (getRoomBySocket(socketId)?.code === room.code) {
    const you = room.players.find((p) => p.socketId === socketId);
    if (you) return { room, playerId: you.id, replacedSocketIds: [] as string[] };
  }
  abandonCurrentSeat(socketId);
  if (userId) {
    const existing = room.players.find((p) => p.userId === userId);
    if (existing) {
      const extra = evacuateUser(userId, room.code);
      const replaced = claimSeat(room, existing, socketId);
      emitState(room);
      return {
        room,
        playerId: existing.id,
        replacedSocketIds: [...extra, ...(replaced ? [replaced] : [])],
      };
    }
    const replacedSocketIds = evacuateUser(userId);
    const playerName = sanitizeName(name);
    const vacated = claimDisconnectedName(room, socketId, playerName, userId);
    if (vacated) return vacated;
    if (room.players.length >= MAX_PLAYERS) {
      return { error: "Ce salon est complet (10 joueurs)" as const };
    }
    if (room.players.some((p) => foldPlayerName(p.name) === foldPlayerName(playerName))) {
      return { error: "Ce prénom est déjà pris dans ce salon" as const };
    }
    const player = makePlayer(socketId, playerName, nextColor(room), userId);
    room.players.push(player);
    socketRoom.set(socketId, room.code);
    emitState(room);
    return { room, playerId: player.id, replacedSocketIds };
  }
  const playerName = sanitizeName(name);
  const vacated = claimDisconnectedName(room, socketId, playerName, userId);
  if (vacated) return vacated;
  if (room.players.length >= MAX_PLAYERS) {
    return { error: "Ce salon est complet (10 joueurs)" as const };
  }
  if (room.players.some((p) => foldPlayerName(p.name) === foldPlayerName(playerName))) {
    return { error: "Ce prénom est déjà pris dans ce salon" as const };
  }
  const player = makePlayer(socketId, playerName, nextColor(room), userId);
  room.players.push(player);
  socketRoom.set(socketId, room.code);
  emitState(room);
  return { room, playerId: player.id, replacedSocketIds: [] as string[] };
}

export function rejoinRoom(socketId: string, code: string, playerId: string, userId: string | null = null) {
  const room = rooms.get(code.trim().toUpperCase());
  if (!room) return { error: "Salon introuvable" as const };
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "Joueur introuvable" as const };
  const replacedSocketId = claimSeat(room, player, socketId);
  if (userId && !player.userId) player.userId = userId;
  emitState(room);
  return {
    room,
    playerId: player.id,
    replacedSocketIds: replacedSocketId ? [replacedSocketId] : [],
  };
}

export function rejoinByUserId(socketId: string, userId: string) {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.userId === userId);
    if (!player) continue;
    const replacedSocketId = claimSeat(room, player, socketId);
    emitState(room);
    return {
      room,
      playerId: player.id,
      replacedSocketIds: replacedSocketId ? [replacedSocketId] : [],
    };
  }
  return null;
}

function removePlayer(room: Room, player: Player) {
  if (player.socketId) socketRoom.delete(player.socketId);
  room.players = room.players.filter((p) => p.id !== player.id);
  room.rerollVotes.delete(player.id);
  if (room.players.length === 0) {
    destroyRoom(room);
    return;
  }
  if (room.hostId === player.id) {
    room.hostId = room.players[0].id;
  }
  emitState(room);
}

function parkPlayer(room: Room, player: Player) {
  if (player.socketId) socketRoom.delete(player.socketId);
  player.socketId = null;
  player.disconnectedAt = Date.now();
  if (player.id === room.hostId) {
    const nextHost = room.players.find((p) => p.id !== player.id && isConnected(p));
    if (nextHost) room.hostId = nextHost.id;
  }
  emitState(room);
}

export function leaveSocket(socketId: string) {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const player = room.players.find((p) => p.socketId === socketId);
  socketRoom.delete(socketId);
  if (!player) return;
  parkPlayer(room, player);
}

/** Leave the lobby for good; mid-game, keep the seat if others are still playing. */
export function leaveRoom(socketId: string, userId: string | null = null) {
  const room = getRoomBySocket(socketId);
  if (room) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) {
      socketRoom.delete(socketId);
      return;
    }
    const othersOnline = room.players.some((p) => p.id !== player.id && isConnected(p));
    if (gameInProgress(room) && othersOnline) {
      parkPlayer(room, player);
      return;
    }
    socketRoom.delete(socketId);
    removePlayer(room, player);
    return;
  }
  if (!userId) return;
  for (const open of [...rooms.values()]) {
    if (gameInProgress(open)) continue;
    const stranded = open.players.find((p) => p.userId === userId && !isConnected(p));
    if (stranded) removePlayer(open, stranded);
  }
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
  room.likes = new Map();
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + room.settings.durationSec * 1000;
  for (const p of room.players) {
    p.words = [];
    p.roundScore = 0;
    p.earnedBadges = [];
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
  const online = room.players.filter(isConnected);
  const unanimous = online.length > 0 && online.every((p) => room.rerollVotes.has(p.id));
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
  if (player.userId) {
    const extra = awardLexicographer(player.userId);
    if (extra.length) {
      player.earnedBadges = [...player.earnedBadges, ...extra];
      for (const badge of extra) announceBadge(room, player, badge);
    }
  }
  emitState(room);
  return { ok: true as const };
}

