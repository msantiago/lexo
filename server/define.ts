import { readingsFor, type Reading } from "./dictionary.ts";

export type WordSense = {
  label: string;
  definitions: string[];
};

export type WordDefinition = {
  word: string;
  senses: WordSense[];
};

const SKIP = new Set([
  "étymologie",
  "prononciation",
  "anagrammes",
  "références",
  "voir",
  "voir aussi",
  "notes",
  "dérivés",
  "apparentés",
  "vocabulaire",
  "synonymes",
  "antonymes",
  "traductions",
  "homophones",
  "paronymes",
  "variantes",
]);

const POS: Record<string, string> = {
  nom: "Nom",
  "nom-propre": "Nom propre",
  verbe: "Verbe",
  adjectif: "Adjectif",
  adj: "Adjectif",
  adverbe: "Adverbe",
  adv: "Adverbe",
  interjection: "Interjection",
  interj: "Interjection",
  préposition: "Préposition",
  prép: "Préposition",
  conjonction: "Conjonction",
  conj: "Conjonction",
  pronom: "Pronom",
  particule: "Particule",
  onomatopée: "Onomatopée",
  locution: "Locution",
  "locution-phrase": "Locution",
  suffixe: "Suffixe",
  préfixe: "Préfixe",
};

const MAX_SENSES = 6;
const MAX_DEFS = 3;
const cache = new Map<string, WordDefinition>();
const pageCache = new Map<string, RawSense[]>();
const CACHE_MAX = 400;

const KIND_RANK: Record<Reading["kind"], number> = {
  N: 0,
  A: 1,
  D: 2,
  Vi: 3,
  Vc: 4,
  Vp: 5,
  Vr: 6,
  X: 7,
};

const KIND_POS: Record<Reading["kind"], ReadonlySet<string> | null> = {
  N: new Set(["nom"]),
  A: new Set(["adjectif", "adj"]),
  D: new Set(["adverbe", "adv"]),
  Vi: new Set(["verbe"]),
  Vc: new Set(["verbe"]),
  Vp: new Set(["verbe", "adjectif", "adj"]),
  Vr: new Set(["verbe"]),
  X: null,
};

type RawSense = {
  pos: string;
  genre: "m" | "f" | "mf" | null;
  label: string;
  definitions: string[];
};

export function normalizeDefineWord(raw: string): string | null {
  const word = raw.trim().toLowerCase().normalize("NFC");
  if (!word || word.length > 40) return null;
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(word)) return null;
  return word;
}

export async function defineWord(word: string): Promise<WordDefinition> {
  const hit = cache.get(word);
  if (hit) return hit;
  const definition = await buildDefinition(word);
  cache.set(word, definition);
  trimCache(cache);
  return definition;
}

async function buildDefinition(word: string): Promise<WordDefinition> {
  const readings = [...readingsFor(word)].sort((a, b) => rank(a) - rank(b));
  if (!readings.length) {
    return { word, senses: fallbackSenses(await fetchSenses(word)) };
  }

  const lemmas = [...new Set(readings.map((reading) => reading.lemma))];
  const byLemma = new Map<string, RawSense[]>();
  await Promise.all(
    lemmas.map(async (lemma) => {
      byLemma.set(lemma, await fetchSenses(lemma));
    }),
  );

  const senses: WordSense[] = [];
  const seen = new Set<string>();
  for (const reading of readings) {
    if (senses.length >= MAX_SENSES) break;
    const grammar = grammarLabel(reading);
    const sameLemma = sameWord(reading.lemma, word);
    const label = grammar && !sameLemma ? `${grammar} · ${reading.lemma}` : grammar;
    const key = `${label}|${reading.lemma}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (reading.kind === "X") {
      const extra = fallbackSenses(byLemma.get(reading.lemma) ?? []);
      for (const sense of extra) {
        if (senses.length >= MAX_SENSES) break;
        senses.push(sense);
      }
      continue;
    }

    let definitions = pickDefinitions(byLemma.get(reading.lemma) ?? [], reading);
    if (!definitions.length && !sameWord(reading.lemma, reading.display)) {
      definitions = pickDefinitions(await fetchSenses(reading.display), reading);
    }
    if (!definitions.length) continue;
    senses.push({ label: label || "Définition", definitions });
  }
  return { word, senses };
}

function rank(reading: Reading): number {
  return KIND_RANK[reading.kind] * 4 + (reading.genre === "f" ? 2 : 0) + (reading.nombre === "p" ? 1 : 0);
}

function grammarLabel(reading: Reading): string {
  const base =
    reading.kind === "N"
      ? "Nom"
      : reading.kind === "A"
        ? "Adjectif"
        : reading.kind === "D"
          ? "Adverbe"
          : reading.kind === "Vp"
            ? "Participe passé"
            : reading.kind === "Vr"
              ? "Participe présent"
              : reading.kind === "Vi" || reading.kind === "Vc"
                ? "Verbe"
                : "";
  if (!base || reading.kind === "D" || reading.kind === "Vi" || reading.kind === "Vc" || reading.kind === "Vr") {
    return base;
  }
  const genre = reading.genre === "m" ? "masculin" : reading.genre === "f" ? "féminin" : "";
  const nombre = reading.nombre === "p" ? "pluriel" : "";
  return [base, genre, nombre].filter(Boolean).join(" ");
}

function sameWord(a: string, b: string): boolean {
  return a.normalize("NFC").toLocaleLowerCase("fr") === b.normalize("NFC").toLocaleLowerCase("fr");
}

function pickDefinitions(raw: RawSense[], reading: Reading): string[] {
  const wanted = KIND_POS[reading.kind];
  let pool = wanted ? raw.filter((sense) => wanted.has(sense.pos)) : raw;
  if (!pool.length) pool = raw;
  if (reading.genre) {
    const gendered = pool.filter((sense) => sense.genre === reading.genre || sense.genre === "mf");
    if (gendered.length) pool = gendered;
  }
  const definitions: string[] = [];
  for (const sense of pool) {
    for (const definition of sense.definitions) {
      if (definitions.length >= MAX_DEFS) return definitions;
      if (!definitions.includes(definition)) definitions.push(definition);
    }
  }
  return definitions;
}

function fallbackSenses(raw: RawSense[]): WordSense[] {
  return raw.slice(0, MAX_SENSES).map((sense) => ({
    label: sense.label,
    definitions: sense.definitions.slice(0, MAX_DEFS),
  }));
}

async function fetchSenses(page: string): Promise<RawSense[]> {
  const key = page.normalize("NFC").toLocaleLowerCase("fr");
  const hit = pageCache.get(key);
  if (hit) return hit;
  const senses = parseSenses(await fetchWikitext(page));
  pageCache.set(key, senses);
  trimCache(pageCache);
  return senses;
}

function trimCache<T>(map: Map<string, T>) {
  if (map.size <= CACHE_MAX) return;
  const oldest = map.keys().next().value;
  if (oldest) map.delete(oldest);
}

async function fetchWikitext(page: string): Promise<string> {
  const url =
    "https://fr.wiktionary.org/w/api.php?" +
    new URLSearchParams({
      action: "parse",
      page,
      prop: "wikitext",
      format: "json",
      redirects: "1",
    });
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Lexo/1.8 (https://github.com/msantiago/lexo; definition lookup)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Wiktionnaire ${res.status}`);
  const data = (await res.json()) as {
    error?: { code?: string };
    parse?: { wikitext?: { "*"?: string } };
  };
  if (data.error?.code === "missingtitle") return "";
  if (data.error) throw new Error(data.error.code ?? "Wiktionnaire");
  return data.parse?.wikitext?.["*"] ?? "";
}

function parseSenses(wikitext: string): RawSense[] {
  const french = wikitext.match(/==\s*\{\{langue\|fr\}\}\s*==\n([\s\S]*?)(?=\n==[^=]|$)/);
  if (!french) return [];
  const parts = french[1].split(/^===\s*\{\{S\|/m).slice(1);
  const senses: RawSense[] = [];
  for (const part of parts) {
    const headerEnd = part.indexOf("}}");
    if (headerEnd < 0) continue;
    const header = part.slice(0, headerEnd);
    const parsed = senseHeader(header);
    if (!parsed) continue;
    const definitions: string[] = [];
    for (const line of part.slice(headerEnd + 2).split("\n")) {
      if (definitions.length >= MAX_DEFS) break;
      if (!line.startsWith("# ") && !line.startsWith("#\t")) continue;
      const plain = wikiPlain(line.slice(2));
      if (plain) definitions.push(plain);
    }
    if (definitions.length) senses.push({ ...parsed, definitions });
  }
  return senses;
}

function senseHeader(raw: string): Omit<RawSense, "definitions"> | null {
  if (raw.split("|").some((part) => part.trim().toLowerCase() === "flexion")) return null;
  const code = raw.split("|")[0]?.trim().toLowerCase() ?? "";
  if (!code || SKIP.has(code)) return null;
  const genreMatch = raw.match(/genre\s*=\s*(mf|m|f)\b/i);
  const genre = (genreMatch?.[1]?.toLowerCase() as "m" | "f" | "mf" | undefined) ?? null;
  const base = POS[code] ?? code.charAt(0).toUpperCase() + code.slice(1);
  const genreLabel = genre === "m" ? "masculin" : genre === "f" ? "féminin" : genre === "mf" ? "masculin et féminin" : "";
  const num = raw.match(/num\s*=\s*(\d+)/);
  const numbered = num && num[1] !== "1" ? `${base} ${num[1]}` : base;
  const label = genreLabel ? `${numbered} ${genreLabel}` : numbered;
  return { pos: code, genre, label };
}

function wikiPlain(input: string): string {
  let text = input.trim();
  text = text.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1");
  text = text.replace(/\{\{(?:lexique|terme|term)\|([^|}]+)[^}]*\}\}/gi, (_, label: string) =>
    note(label),
  );
  text = text.replace(/\{\{([^|{}]+)\|fr\}\}/gi, (_, label: string) => note(label));
  for (let i = 0; i < 6; i++) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, "");
    if (next === text) break;
    text = next;
  }
  text = text.replace(/\{\{[\s\S]*?\}\}/g, "");
  text = text.replace(/'''|''/g, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^[,;:.\s]+/, "");
  if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  return text;
}

function note(label: string): string {
  const clean = label.trim();
  if (!clean) return "";
  return `(${clean.charAt(0).toUpperCase()}${clean.slice(1)}) `;
}
