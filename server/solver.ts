import { neighbors, rollGrid, wordPoints } from "../shared/dice.ts";
import {
  DIFFICULTY_BANDS,
  type Cell,
  type GameSettings,
  type PossibleWord,
} from "../shared/types.ts";
import { dictionary, lookupWord } from "./dictionary.ts";

const ADJ: number[][] = Array.from({ length: 16 }, (_, i) => neighbors(i));
const A_CODE = "A".charCodeAt(0);

type TrieNode = {
  kids: Array<TrieNode | undefined>;
  key: string | null;
};

function buildTrie(): TrieNode {
  const root: TrieNode = { kids: new Array(26), key: null };
  for (const key of dictionary.keys()) {
    let node = root;
    for (let i = 0; i < key.length; i++) {
      const code = key.charCodeAt(i) - A_CODE;
      let child = node.kids[code];
      if (!child) {
        child = { kids: new Array(26), key: null };
        node.kids[code] = child;
      }
      node = child;
    }
    node.key = key;
  }
  return root;
}

const TRIE = buildTrie();

// À 5 lettres minimum, une grille dans la fourchette est rare : environ 1 sur
// 60 en moyen, 1 sur 300 en facile, 1 sur 10 000 en très facile. On cherche
// jusqu’à tomber dedans, au lieu de rendre la grille la moins éloignée.
const MAX_ROLL_ATTEMPTS = 80_000;
const YIELD_EVERY = 500;

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

function step(node: TrieNode, letter: string): TrieNode | undefined {
  let next = node.kids[letter.charCodeAt(0) - A_CODE];
  if (next && letter.length === 2) next = next.kids[letter.charCodeAt(1) - A_CODE];
  return next;
}

function quSteps(node: TrieNode): Array<{ node: TrieNode; letters: number }> {
  const out: Array<{ node: TrieNode; letters: number }> = [];
  const asQ = step(node, "Q");
  if (asQ) out.push({ node: asQ, letters: 1 });
  const asQU = step(node, "QU");
  if (asQU) out.push({ node: asQU, letters: 2 });
  return out;
}

function collectWords(grid: Cell[], settings: GameSettings): PossibleWord[] {
  const hits = new Map<string, PossibleWord>();
  const seen = new Set<string>();
  const min = settings.minLetters;

  const dfs = (index: number, used: number, node: TrieNode, letters: number) => {
    const key = node.key;
    if (key && letters >= min && !seen.has(key)) {
      seen.add(key);
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
      const cell = grid[next];
      if (cell.letter === "QU") {
        for (const branch of quSteps(node)) {
          dfs(next, used | (1 << next), branch.node, letters + branch.letters);
        }
        continue;
      }
      const child = step(node, cell.letter);
      if (!child) continue;
      dfs(next, used | (1 << next), child, letters + cell.letterCount);
    }
  };

  for (let i = 0; i < 16; i++) {
    const cell = grid[i];
    if (cell.letter === "QU") {
      for (const branch of quSteps(TRIE)) {
        dfs(i, 1 << i, branch.node, branch.letters);
      }
      continue;
    }
    const node = step(TRIE, cell.letter);
    if (!node) continue;
    dfs(i, 1 << i, node, cell.letterCount);
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

function breathe(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export async function rollPlayableGrid(settings: GameSettings): Promise<{
  grid: Cell[];
  words: PossibleWord[];
}> {
  const { min, max } = bandFor(settings);
  const shuffle = settings.letterOrientation === "shuffle";
  let bestGrid = rollGrid(shuffle);
  let bestWords = collectWords(bestGrid, settings);

  for (let attempt = 1; attempt < MAX_ROLL_ATTEMPTS && !inBand(bestWords.length, min, max); attempt++) {
    if (attempt % YIELD_EVERY === 0) await breathe();
    const grid = rollGrid(shuffle);
    const words = collectWords(grid, settings);
    if (betterCount(words.length, bestWords.length, min, max)) {
      bestGrid = grid;
      bestWords = words;
    }
  }

  return { grid: bestGrid, words: sortWords(bestWords) };
}
