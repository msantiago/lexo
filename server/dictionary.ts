import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GameSettings, WordFailReason } from "../shared/types.ts";

type Kind = "N" | "A" | "D" | "X" | "Vi" | "Vp" | "Vr" | "Vc";

export type Reading = {
  display: string;
  lemma: string;
  kind: Kind;
  genre: "m" | "f" | null;
  nombre: "s" | "p" | null;
};

const FOLD: Record<string, string> = {
  à: "A",
  á: "A",
  â: "A",
  ä: "A",
  ã: "A",
  å: "A",
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
  õ: "O",
  ù: "U",
  ú: "U",
  û: "U",
  ü: "U",
  ý: "Y",
  ÿ: "Y",
  ç: "C",
  ñ: "N",
  œ: "OE",
  Œ: "OE",
  æ: "AE",
  Æ: "AE",
};

export function foldKey(raw: string): string {
  let out = "";
  for (const ch of raw.normalize("NFC")) out += FOLD[ch] ?? ch.toUpperCase();
  return out;
}

const KIND_RE = /^(N|A|D|X|Vi|Vp|Vr|Vc)([mf])?([sp])?$/;
const here = path.dirname(fileURLToPath(import.meta.url));
const customFile = path.resolve(here, "../data/custom-words.json");

function parseToken(token: string): Reading | null {
  const colon = token.indexOf(":");
  if (colon <= 0) return null;
  const display = token.slice(0, colon);
  const rest = token.slice(colon + 1);
  const colon2 = rest.indexOf(":");
  const code = colon2 < 0 ? rest : rest.slice(0, colon2);
  const lemma = colon2 < 0 ? display : rest.slice(colon2 + 1);
  const m = KIND_RE.exec(code);
  if (!m || !lemma) return null;
  return {
    display,
    lemma,
    kind: m[1] as Kind,
    genre: (m[2] as "m" | "f") || null,
    nombre: (m[3] as "s" | "p") || null,
  };
}

export function readingsFor(word: string): Reading[] {
  const all = dictionary.get(foldKey(word));
  if (!all?.length) return [];
  const wanted = word.normalize("NFC").toLocaleLowerCase("fr");
  const exact = all.filter((reading) => reading.display.normalize("NFC").toLocaleLowerCase("fr") === wanted);
  return exact.length ? exact : all;
}

function loadCustom(): Record<string, string> {
  if (!existsSync(customFile)) return {};
  try {
    return JSON.parse(readFileSync(customFile, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function loadDict(): Map<string, Reading[]> {
  const file = path.resolve(here, "../data/dictionary.json.gz");
  const json = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Record<
    string,
    string
  >;
  const map = new Map<string, Reading[]>();
  for (const [key, raw] of Object.entries(json)) {
    const readings: Reading[] = [];
    for (const token of raw.split("|")) {
      const parsed = parseToken(token);
      if (parsed) readings.push(parsed);
    }
    if (readings.length) map.set(key, readings);
  }
  for (const [key, display] of Object.entries(loadCustom())) {
    if (!map.has(key)) {
      map.set(key, [{ display, lemma: display, kind: "X", genre: null, nombre: null }]);
    }
  }
  return map;
}

export const dictionary = loadDict();

const prefixes = new Set<string>();
for (const key of dictionary.keys()) addPrefixes(key);

function addPrefixes(key: string) {
  for (let i = 1; i <= key.length; i++) prefixes.add(key.slice(0, i));
}

export function hasPrefix(key: string): boolean {
  return prefixes.has(key);
}

export function addCustomWord(key: string, display: string): boolean {
  const k = key.toUpperCase();
  if (!/^[A-Z]+$/.test(k) || k.length < 2) return false;
  if (dictionary.has(k)) return false;
  const shown = display.trim() || k.toLowerCase();
  dictionary.set(k, [{ display: shown, lemma: shown, kind: "X", genre: null, nombre: null }]);
  addPrefixes(k);
  const extras = loadCustom();
  extras[k] = shown;
  mkdirSync(path.dirname(customFile), { recursive: true });
  writeFileSync(customFile, `${JSON.stringify(extras, null, 2)}\n`);
  return true;
}

const NON_VERB: ReadonlySet<Kind> = new Set(["N", "A", "D", "X"]);

function rejectReading(
  reading: Reading,
  settings: GameSettings,
): WordFailReason | null {
  if (reading.nombre === "p" && !settings.allowPlurals) return "plural";
  const feminineForm =
    reading.kind === "A" ||
    reading.kind === "Vi" ||
    reading.kind === "Vp" ||
    reading.kind === "Vr" ||
    reading.kind === "Vc";
  if (feminineForm && reading.genre === "f" && !settings.allowFeminines) {
    return "feminine";
  }

  if (NON_VERB.has(reading.kind)) return null;
  if (reading.kind === "Vi") return null;

  if (settings.conjugations === "all") return null;

  if (reading.kind === "Vp") {
    return settings.allowPastParticiple ? null : "conjugation";
  }
  if (reading.kind === "Vr") {
    return settings.allowPresentParticiple ? null : "conjugation";
  }
  return "conjugation";
}

const REJECT_RANK: WordFailReason[] = [
  "conjugation",
  "plural",
  "feminine",
  "unknown",
];

export function lookupWord(
  key: string,
  settings: GameSettings,
): { ok: true; display: string } | { ok: false; reason: WordFailReason } {
  const readings = dictionary.get(key);
  if (!readings?.length) return { ok: false, reason: "unknown" };

  const rejects: WordFailReason[] = [];
  for (const reading of readings) {
    const reject = rejectReading(reading, settings);
    if (!reject) return { ok: true, display: reading.display };
    rejects.push(reject);
  }

  for (const reason of REJECT_RANK) {
    if (rejects.includes(reason)) return { ok: false, reason };
  }
  return { ok: false, reason: "unknown" };
}
