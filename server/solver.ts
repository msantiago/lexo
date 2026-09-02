import { neighbors, rollGrid, wordPoints } from "../shared/dice.ts";
import {
  DIFFICULTY_BANDS,
  type Cell,
  type GameSettings,
  type PossibleWord,
} from "../shared/types.ts";
import { hasPrefix, lookupWord } from "./dictionary.ts";

const ADJ: number[][] = Array.from({ length: 16 }, (_, i) => neighbors(i));

const MAX_ROLL_ATTEMPTS = 120;

function bandFor(settings: GameSettings) {
  return DIFFICULTY_BANDS[settings.difficulty] ?? DIFFICULTY_BANDS.medium;
}

function inBand(count: number, min: number, max: number) {
  return count >= min && count <= max;
}

function betterCount(next: number, current: number, min: number, max: number) {
  const nextIn = inBand(next, min, max);
  const currentIn = inBand(current, min, max);
  if (nextIn !== currentIn) return nextIn;
  if (nextIn) {
    if (!Number.isFinite(max)) return next > current;
    const mid = (min + max) / 2;
    return Math.abs(next - mid) < Math.abs(current - mid);
  }
  const dist = (n: number) => (n < min ? min - n : n - max);
  const nextDist = dist(next);
  const currentDist = dist(current);
  if (nextDist !== currentDist) return nextDist < currentDist;
  return next > current;
}

function collectWords(grid: Cell[], settings: GameSettings): PossibleWord[] {
  const hits = new Map<string, PossibleWord>();
  const min = settings.minLetters;

  const dfs = (index: number, used: number, key: string, letters: number) => {
    if (letters >= min && !hits.has(key)) {
      const found = lookupWord(key, settings);
      if (found.ok) {
        hits.set(key, {
          key,
          display: found.display,
          letters,
          points: wordPoints(letters, false),
        });
      }
    }
    for (const next of ADJ[index]) {
      if (used & (1 << next)) continue;
      const nextKey = key + grid[next].letter;
      if (!hasPrefix(nextKey)) continue;
      dfs(next, used | (1 << next), nextKey, letters + grid[next].letterCount);
    }
  };

  for (let i = 0; i < 16; i++) {
    const key = grid[i].letter;
    if (!hasPrefix(key)) continue;
    dfs(i, 1 << i, key, grid[i].letterCount);
  }

  return [...hits.values()];
}

function sortWords(words: PossibleWord[]): PossibleWord[] {
  return words.sort(
    (a, b) => b.letters - a.letters || a.display.localeCompare(b.display, "fr"),
  );
}

export function findAllWords(grid: Cell[], settings: GameSettings): PossibleWord[] {
  return sortWords(collectWords(grid, settings));
}

export function rollPlayableGrid(settings: GameSettings): {
  grid: Cell[];
  words: PossibleWord[];
} {
  const { min, max } = bandFor(settings);
  let bestGrid = rollGrid();
  let bestWords = collectWords(bestGrid, settings);

  for (let attempt = 1; attempt < MAX_ROLL_ATTEMPTS && !inBand(bestWords.length, min, max); attempt++) {
    const grid = rollGrid();
    const words = collectWords(grid, settings);
    if (betterCount(words.length, bestWords.length, min, max)) {
      bestGrid = grid;
      bestWords = words;
    }
  }

  return { grid: bestGrid, words: sortWords(bestWords) };
}
