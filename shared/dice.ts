import type { Cell, DieRotation } from "./types.ts";

/** Classic French Boggle dice (Q is played as Qu). */
export const DICE: readonly string[][] = [
  ["E", "T", "U", "K", "N", "O"],
  ["E", "V", "G", "T", "I", "N"],
  ["D", "E", "C", "A", "M", "P"],
  ["I", "E", "L", "R", "U", "W"],
  ["E", "H", "I", "F", "S", "E"],
  ["R", "E", "C", "A", "L", "S"],
  ["E", "N", "T", "D", "O", "S"],
  ["O", "F", "X", "R", "I", "A"],
  ["N", "A", "V", "E", "D", "Z"],
  ["E", "I", "O", "A", "T", "A"],
  ["G", "L", "E", "N", "Y", "U"],
  ["B", "M", "A", "Q", "J", "O"],
  ["T", "L", "I", "B", "R", "A"],
  ["S", "P", "U", "L", "T", "E"],
  ["A", "I", "M", "S", "O", "R"],
  ["E", "N", "H", "R", "I", "S"],
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ROTATIONS: DieRotation[] = [0, 90, 180, 270];

export function toCell(face: string, rotation: DieRotation = 0): Cell {
  if (face === "Q") {
    return { letter: "QU", display: "Qu", letterCount: 2, rotation };
  }
  return { letter: face, display: face, letterCount: 1, rotation };
}

export function rollGrid(shuffleLetters = false): Cell[] {
  return shuffle([...DICE]).map((die) => {
    const face = die[Math.floor(Math.random() * die.length)];
    const rotation = shuffleLetters
      ? ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)]
      : 0;
    return toCell(face, rotation);
  });
}

export function neighbors(index: number): number[] {
  const r = Math.floor(index / 4);
  const c = index % 4;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) out.push(nr * 4 + nc);
    }
  }
  return out;
}

export function isAdjacent(a: number, b: number): boolean {
  const ar = Math.floor(a / 4);
  const ac = a % 4;
  const br = Math.floor(b / 4);
  const bc = b % 4;
  return Math.max(Math.abs(ar - br), Math.abs(ac - bc)) === 1;
}

export function isValidPath(cells: number[]): boolean {
  if (cells.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell < 0 || cell > 15 || seen.has(cell)) return false;
    if (i > 0 && !isAdjacent(cells[i - 1], cell)) return false;
    seen.add(cell);
  }
  return true;
}

/**
 * Lecture d’une face Qu dans un chemin :
 * - suivie d’un U (autre case) → Q seul (ex. Qu+U = QU)
 * - en fin de chemin → Q seul (ex. COQ)
 * - sinon → Qu (ex. Qu+I = QUI)
 */
export function quContribution(
  grid: Cell[],
  cells: number[],
  index: number,
): { key: string; display: string; letters: number } {
  const next = cells[index + 1];
  const nextIsU = next !== undefined && grid[next]?.letter === "U";
  if (nextIsU || index === cells.length - 1) {
    return { key: "Q", display: "Q", letters: 1 };
  }
  return { key: "QU", display: "Qu", letters: 2 };
}

export function pathToWord(grid: Cell[], cells: number[]) {
  let key = "";
  let display = "";
  let letters = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = grid[cells[i]];
    if (cell.letter === "QU") {
      const part = quContribution(grid, cells, i);
      key += part.key;
      display += part.display;
      letters += part.letters;
    } else {
      key += cell.letter;
      display += cell.display;
      letters += cell.letterCount;
    }
  }
  return { key, display, letters };
}

export function wordPoints(letters: number, shared: boolean): number {
  if (shared) return 0;
  return Math.max(1, letters - 3);
}

const FOLD: Record<string, string> = {
  à: "A",
  á: "A",
  â: "A",
  ä: "A",
  è: "E",
  é: "E",
  ê: "E",
  ë: "E",
  ì: "I",
  í: "I",
  î: "I",
  ï: "I",
  ò: "O",
  ó: "O",
  ô: "O",
  ö: "O",
  ù: "U",
  ú: "U",
  û: "U",
  ü: "U",
  ý: "Y",
  ÿ: "Y",
  ç: "C",
};

export function foldKey(key: string): string | null {
  if (key.length !== 1) return null;
  const ch = key.normalize("NFC");
  const folded = (FOLD[ch] ?? ch).toUpperCase();
  return /^[A-Z]$/.test(folded) ? folded : null;
}

function cellExpansions(letter: string): string[] {
  return letter === "QU" ? ["Q", "QU"] : [letter];
}

/** First valid Boggle path whose cells spell `target` (e.g. Qu+I → "QUI", Qu+U → "QU"). */
export function findPathForWord(grid: Cell[], target: string): number[] | null {
  if (!target) return [];
  const dfs = (path: number[], built: string): number[] | null => {
    if (built === target) return path;
    const last = path[path.length - 1];
    const nexts = path.length === 0 ? grid.map((_, i) => i) : neighbors(last);
    for (const i of nexts) {
      if (path.includes(i)) continue;
      for (const part of cellExpansions(grid[i].letter)) {
        const next = built + part;
        if (!target.startsWith(next)) continue;
        const hit = dfs([...path, i], next);
        if (hit) return hit;
      }
    }
    return null;
  };
  return dfs([], "");
}

/**
 * Try to add a typed letter. Q may be Q seul (COQ) or Qu (QUI).
 * A U after Qu is kept only if a separate U cell can be used; otherwise it is
 * ignored as already in Qu.
 */
export function extendTypedWord(
  grid: Cell[],
  typed: string,
  letter: string,
): string | null {
  if (letter === "Q") {
    for (const next of [typed + "Q", typed + "QU"]) {
      if (findPathForWord(grid, next)) return next;
    }
    return null;
  }
  const next = typed + letter;
  if (findPathForWord(grid, next)) return next;
  if (letter === "U" && typed.endsWith("QU")) return typed;
  return null;
}
