import type { Cell, PossibleWord } from "./types.ts";

/** Trois minutes, comme une manche classique. */
export const DAILY_DURATION_SEC = 180;

/** Total des points qu’on peut prendre sur une grille. */
export function gridPoints(words: readonly { points?: number }[]): number {
  return words.reduce((sum, word) => sum + (word.points || 0), 0);
}

/**
 * Part du meilleur score du jour. Le meilleur vaut 100,
 * les autres sont un pourcentage de ce score.
 */
export function fieldIndex(score: number, best: number): number {
  if (best <= 0) return 100;
  return (100 * score) / best;
}

/**
 * Jours d’affilée pour que l’indice vaille toute la moyenne.
 * Avant, il est au prorata : une série courte reste derrière une série longue,
 * et repartir de zéro après une mauvaise journée ne rattrape pas.
 */
export const DAILY_STREAK_FULL = 7;

/** Moyenne de la série, pondérée par sa longueur. Sans série, l’indice repart à 0. */
export function dailyRating(indexSum: number, settled: number): number {
  if (settled <= 0) return 0;
  const weight = Math.min(1, settled / DAILY_STREAK_FULL);
  return (indexSum / settled) * weight;
}

/** Jours joués d’affilée en remontant depuis `end`, celui-ci inclus. */
export function streakDays(played: ReadonlySet<string>, end: string): string[] {
  const days: string[] = [];
  let cursor = end;
  while (played.has(cursor)) {
    days.push(cursor);
    cursor = previousParisDay(cursor);
  }
  return days;
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
