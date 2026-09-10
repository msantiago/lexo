import type { BadgeDef, BadgeView } from "./badges.ts";
import type { Cell, GameSettings, RoundSummary, WordRecap } from "./types.ts";

export type AuthProviderId =
  | "google"
  | "apple"
  | "facebook"
  | "microsoft"
  | "github"
  | "discord";

export type AuthProviders = Record<AuthProviderId, boolean>;

export type UserStats = {
  gamesPlayed: number;
  roundsPlayed: number;
  wordsFound: number;
  uniqueWords: number;
  totalPoints: number;
  longestWord: number;
  bestRoundScore: number;
  bestRoundWords: number;
  wins: number;
  soloGames: number;
  multiGames: number;
  hostedGames: number;
};

export type HistoryPlayer = {
  name: string;
  color: string;
  score: number;
  you: boolean;
};

export type GameHistoryItem = {
  id: string;
  solo: boolean;
  createdAt: number;
  updatedAt: number;
  roundCount: number;
  difficulty: GameSettings["difficulty"];
  yourScore: number;
  players: HistoryPlayer[];
};

export type HistoryRound = {
  round: number;
  startedAt: number | null;
  endedAt: number;
  grid: Cell[] | null;
  recap: WordRecap[];
  summary: RoundSummary | null;
  players: HistoryPlayer[];
};

export type GameHistoryDetail = {
  id: string;
  solo: boolean;
  createdAt: number;
  settings: GameSettings;
  rounds: HistoryRound[];
};

export type WordFreq = {
  key: string;
  display: string;
  count: number;
  points: number;
  letters: number;
  sharedCount: number;
};

export type LengthBucket = {
  length: number;
  count: number;
  points: number;
};

export type LetterBucket = {
  letter: string;
  count: number;
};

export type WordStatsPayload = {
  total: number;
  distinct: number;
  averageLength: number;
  quCount: number;
  sharedCount: number;
  uniqueCount: number;
  mostFrequent: WordFreq[];
  longest: WordFreq[];
  richest: WordFreq[];
  byLength: LengthBucket[];
  byInitial: LetterBucket[];
};

export type ProfilePayload = {
  stats: UserStats;
  wordStats: WordStatsPayload;
  badges: BadgeView[];
  games: GameHistoryItem[];
  recentUnlocks: BadgeDef[];
};
