import type { Cell, PossibleWord } from "./types.ts";

/** Cinq minutes, un peu plus qu’une manche classique. */
export const DAILY_DURATION_SEC = 300;

/**
 * Cote = (somme des scores + PRIOR × PARTIES) / (parties + PARTIES).
 * Les PARTIES fictives au score PRIOR empêchent un coup d’éclat isolé de
 * détrôner les habitués, tout en laissant un excellent premier jour bien placé.
 */
export const DAILY_PRIOR_SCORE = 30;
export const DAILY_PRIOR_GAMES = 3;

export function dailyRating(totalPoints: number, plays: number): number {
  if (plays <= 0) return 0;
  return (totalPoints + DAILY_PRIOR_SCORE * DAILY_PRIOR_GAMES) / (plays + DAILY_PRIOR_GAMES);
}

export type DailyFoundWord = {
  key: string;
  display: string;
  letters: number;
  points: number;
};

export type DailyStanding = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  plays: number;
  average: number;
  rating: number;
  today: number | null;
  you: boolean;
};

export type DailySolution = {
  day: string;
  grid: Cell[];
  words: PossibleWord[];
};

export type DailyOverview = {
  day: string;
  played: boolean;
  inProgress: boolean;
  endsAt: number | null;
  score: number | null;
  wordCount: number | null;
  words: DailyFoundWord[];
  leaderboard: DailyStanding[];
  yesterday: DailySolution | null;
};

export type DailyPlayState = {
  day: string;
  grid: Cell[];
  endsAt: number;
  words: DailyFoundWord[];
  score: number;
};

export type DailyArchiveRow = {
  day: string;
  wordCount: number;
  possiblePoints: number;
  players: number;
  bestScore: number | null;
  bestNames: string[];
};

export type DailyArchiveDetail = DailyArchiveRow & {
  revealed: boolean;
  grid: Cell[] | null;
  words: PossibleWord[] | null;
};

/** Jour calendaire à Paris, sous la forme AAAA-MM-JJ. */
export function parisDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function previousParisDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month || 1) - 1, date || 1));
  utc.setUTCDate(utc.getUTCDate() - 1);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
