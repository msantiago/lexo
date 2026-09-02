export const MAX_PLAYERS = 10;

export type ConjugationMode = "all" | "participles";

export type GridDifficulty = "very-easy" | "easy" | "medium" | "hard";

export type GameSettings = {
  durationSec: number;
  minLetters: number;
  allowPlurals: boolean;
  allowFeminines: boolean;
  conjugations: ConjugationMode;
  allowPastParticiple: boolean;
  allowPresentParticiple: boolean;
  difficulty: GridDifficulty;
};

export const DIFFICULTY_BANDS: Record<GridDifficulty, { min: number; max: number }> = {
  "very-easy": { min: 141, max: Number.POSITIVE_INFINITY },
  easy: { min: 100, max: 140 },
  medium: { min: 75, max: 99 },
  hard: { min: 40, max: 74 },
};

export const DIFFICULTY_OPTIONS: { id: GridDifficulty; label: string }[] = [
  { id: "very-easy", label: "Très facile" },
  { id: "easy", label: "Facile" },
  { id: "medium", label: "Moyen" },
  { id: "hard", label: "Difficile" },
];

export const DEFAULT_SETTINGS: GameSettings = {
  durationSec: 180,
  minLetters: 4,
  allowPlurals: false,
  allowFeminines: false,
  conjugations: "participles",
  allowPastParticiple: true,
  allowPresentParticiple: true,
  difficulty: "medium",
};

export type Cell = {
  letter: string;
  display: string;
  letterCount: number;
};

export type FoundWord = {
  key: string;
  display: string;
  letters: number;
  points: number;
  shared: boolean;
};

export type PlayerPublic = {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  roundScore: number;
  totalScore: number;
  wordCount: number;
};

export type Phase = "lobby" | "playing" | "results";

export type WordRecap = {
  playerId: string;
  name: string;
  color: string;
  words: FoundWord[];
  roundScore: number;
};

export type SummaryWord = {
  key: string;
  display: string;
  letters: number;
  points: number;
  playerId: string;
  name: string;
  color: string;
};

export type SharedWord = {
  key: string;
  display: string;
  letters: number;
  names: { name: string; color: string }[];
};

export type PossibleWord = {
  key: string;
  display: string;
  letters: number;
  points: number;
};

export type RoundSummary = {
  unique: SummaryWord[];
  shared: SharedWord[];
  rejected: RejectedWord[];
  missed: PossibleWord[];
  possibleCount: number;
};

export type RejectedWord = {
  key: string;
  display: string;
  letters: number;
  names: { name: string; color: string }[];
  added: boolean;
};

export const REROLL_WINDOW_MS = 15_000;

export type RerollView = {
  solo: boolean;
  canVote: boolean;
  youVoted: boolean;
  voterIds: string[];
  needed: number;
  windowEndsAt: number | null;
};

export type RoomView = {
  code: string;
  hostId: string;
  phase: Phase;
  round: number;
  settings: GameSettings;
  players: PlayerPublic[];
  grid: Cell[] | null;
  startedAt: number | null;
  endsAt: number | null;
  you: {
    id: string;
    words: FoundWord[];
  };
  recap: WordRecap[] | null;
  summary: RoundSummary | null;
  reroll: RerollView | null;
};

export type WordFailReason =
  | "too-short"
  | "unknown"
  | "plural"
  | "feminine"
  | "conjugation"
  | "duplicate"
  | "path"
  | "phase";

export type WordSubmitResult =
  | { ok: true; word: FoundWord; shared: boolean }
  | { ok: false; reason: WordFailReason };

export const PLAYER_COLORS = [
  "#FF6B4A",
  "#F4C430",
  "#6FDB9A",
  "#5BA8FF",
  "#C084FC",
  "#FF8DC7",
  "#2DD4BF",
  "#FB923C",
  "#A3E635",
  "#F472B6",
] as const;
