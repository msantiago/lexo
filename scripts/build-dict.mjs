import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import path from "node:path";

/**
 * Builds data/dictionary.json.gz from Grammalecte / Dicollecte 7.7 (MPL-2.0).
 * Source: https://grammalecte.net/dic/lexique-grammalecte-fr-v7.7.zip
 * Variant: Classique (orthographe traditionnelle).
 */
const LEX_VERSION = "7.7";
const LEX_URL = `https://grammalecte.net/dic/lexique-grammalecte-fr-v${LEX_VERSION}.zip`;
const LEX_NAME = `lexique-grammalecte-fr-v${LEX_VERSION}.txt`;
const SRC_DIR = path.resolve("data/src");
const OUT_DIR = path.resolve("data");
const DEFAULT_SRC = path.resolve(SRC_DIR, LEX_NAME);

const FOLD = {
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

const SKIP_POS = new Set([
  "npr",
  "prn",
  "patr",
  "interj",
  "loc.interj",
  "loc.patr",
  "nbro",
  "pfx",
  "sfx",
  "ponc",
  "sign",
  "div",
  "err",
]);

const SKIP_NOTE = new Set(["sig", "symb", "abty"]);
const CONJ_MOODS = new Set([
  "ipre",
  "iimp",
  "ipsi",
  "ifut",
  "cond",
  "spre",
  "simp",
  "impe",
]);

function fold(s) {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (FOLD[ch]) out += FOLD[ch];
    else out += ch.toUpperCase();
  }
  return out;
}

/** Classique = codes Dicollecte dont le dernier caractère est *, C, M ou X. */
function isClassic(subdic) {
  return /[*CMX]$/.test(subdic);
}

function kindsFor(tags) {
  const first = tags[0] || "";
  if (SKIP_POS.has(first)) return [];

  if (first.startsWith("v")) {
    const kinds = [];
    if (tags.includes("infi")) kinds.push("Vi");
    if (tags.includes("ppas")) kinds.push("Vp");
    if (tags.includes("ppre")) kinds.push("Vr");
    if (tags.some((t) => CONJ_MOODS.has(t))) kinds.push("Vc");
    if (kinds.length === 0) kinds.push("Vc");
    return kinds;
  }

  if (first === "nom" || first === "loc.nom") {
    return tags.includes("adj") ? ["N", "A"] : ["N"];
  }
  if (first === "adj" || first === "loc.adj") return ["A"];
  if (first === "adv" || first === "loc.adv" || first === "negadv") return ["D"];
  if (first === "nb") return ["X"];
  return ["X"];
}

function genreOf(tags) {
  if (tags.includes("mas")) return "m";
  if (tags.includes("fem")) return "f";
  return "";
}

function nombreOf(tags) {
  if (tags.includes("pl")) return "p";
  if (tags.includes("sg")) return "s";
  return "";
}

function encode(kind, genre, nombre) {
  if (kind === "Vi" || kind === "Vr" || kind === "Vc") return kind;
  return kind + genre + nombre;
}

async function ensureSource() {
  const override = process.env.GRAMMALECTE_LEX;
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`GRAMMALECTE_LEX introuvable: ${override}`);
    }
    return override;
  }
  if (existsSync(DEFAULT_SRC)) return DEFAULT_SRC;

  await mkdir(SRC_DIR, { recursive: true });
  const zipPath = path.join(SRC_DIR, `lexique-grammalecte-fr-v${LEX_VERSION}.zip`);
  console.log(`Downloading ${LEX_URL}`);
  const res = await fetch(LEX_URL);
  if (!res.ok) throw new Error(`Téléchargement échoué: ${res.status} ${res.statusText}`);
  await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));

  const unzip = spawnSync("unzip", ["-o", zipPath, "-d", SRC_DIR], { encoding: "utf8" });
  if (unzip.status !== 0) {
    throw new Error(`unzip a échoué:\n${unzip.stderr || unzip.stdout}`);
  }
  if (!existsSync(DEFAULT_SRC)) {
    throw new Error(`Fichier ${LEX_NAME} absent après extraction`);
  }
  return DEFAULT_SRC;
}

async function main() {
  const src = await ensureSource();
  const rl = createInterface({
    input: createReadStream(src, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let header = null;
  const idx = {};
  /** @type {Map<string, Map<string, string>>} */
  const dict = new Map();
  let kept = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (line.startsWith("#") || !line.trim()) continue;
    const cols = line.split("\t");
    if (!header) {
      if (!cols.includes("Flexion") || !cols.includes("Étiquettes")) continue;
      header = cols;
      header.forEach((h, i) => {
        idx[h] = i;
      });
      continue;
    }

    const ortho = cols[idx.Flexion];
    const tagsRaw = cols[idx.Étiquettes] || "";
    const notes = cols[idx.Notes] || "";
    const subdic = cols[idx["Sous-dictionnaire"]] || "";
    if (!ortho || !isClassic(subdic)) {
      skipped += 1;
      continue;
    }
    const noteToks = notes.split(/\s+/).filter(Boolean);
    if (noteToks.some((n) => SKIP_NOTE.has(n))) {
      skipped += 1;
      continue;
    }
    // Formes marquées "à éviter", sauf clippings lexicalisés (accro, etc.).
    if (noteToks.includes("fxa") && !noteToks.includes("fam") && !noteToks.includes("arg")) {
      skipped += 1;
      continue;
    }
    if (/[^a-zA-ZàáâäãåèéêëìíîïòóôöõùúûüýÿçñœŒæÆ'-]/.test(ortho)) {
      skipped += 1;
      continue;
    }
    if (ortho.includes("'") || ortho.includes("-") || ortho.includes(" ")) {
      skipped += 1;
      continue;
    }

    const key = fold(ortho);
    if (!/^[A-Z]+$/.test(key) || key.length < 2) {
      skipped += 1;
      continue;
    }

    const tags = tagsRaw.split(/\s+/).filter(Boolean);
    const kinds = kindsFor(tags);
    if (!kinds.length) {
      skipped += 1;
      continue;
    }

    const first = tags[0] || "";
    const invariable = first === "nb" || first === "mg";
    const genre = invariable ? "" : genreOf(tags);
    const nombre = invariable ? "" : nombreOf(tags);
    let bucket = dict.get(key);
    if (!bucket) {
      bucket = new Map();
      dict.set(key, bucket);
    }
    for (const kind of kinds) {
      const token = `${ortho}:${encode(kind, genre, nombre)}`;
      bucket.set(token, token);
    }
    kept += 1;
  }

  const out = {};
  const keys = [...dict.keys()].sort();
  for (const key of keys) {
    out[key] = [...dict.get(key).values()].join("|");
  }

  await mkdir(OUT_DIR, { recursive: true });
  const json = JSON.stringify(out);
  const gz = gzipSync(Buffer.from(json));
  await writeFile(path.join(OUT_DIR, "dictionary.json.gz"), gz);
  console.log(
    `Grammalecte ${LEX_VERSION} Classique: ${kept} lignes, ${keys.length} clés, ` +
      `${skipped} ignorées, ${json.length} o json, ${gz.length} o gzip`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
