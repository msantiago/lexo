import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const SRC = "/tmp/Lexique383.tsv";
const OUT_DIR = path.resolve("data");

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

function fold(s) {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (FOLD[ch]) out += FOLD[ch];
    else out += ch.toUpperCase();
  }
  return out;
}

function kindFor(cgram, infover) {
  const cat = (cgram || "").toUpperCase();
  if (cat === "VER" || cat === "AUX") {
    const info = (infover || "").toLowerCase();
    const tags = [];
    if (info.includes("inf")) tags.push("Vi");
    if (info.includes("par:pas")) tags.push("Vp");
    if (info.includes("par:pre")) tags.push("Vr");
    if (
      /ind:|cnd:|sub:|imp:pre|imp:pas/.test(info) ||
      (info && tags.length === 0)
    ) {
      if (!info.includes("inf") || /ind:|cnd:|sub:|imp:/.test(info)) {
        if (/ind:|cnd:|sub:|imp:pre|imp:pas/.test(info)) tags.push("Vc");
      }
    }
    if (tags.length === 0) tags.push("Vc");
    return tags;
  }
  if (cat === "NOM") return ["N"];
  if (cat.startsWith("ADJ")) return ["A"];
  if (cat === "ADV") return ["D"];
  return ["X"];
}

function gn(genre, nombre) {
  const g = genre === "m" || genre === "f" ? genre : "";
  const n = nombre === "s" || nombre === "p" ? nombre : "";
  return g + n;
}

function encode(kind, genre, nombre) {
  if (kind === "Vi" || kind === "Vr" || kind === "Vc") return kind;
  return kind + gn(genre, nombre);
}

const SKIP_CGRAM = new Set(["ABR", "LIA", ""]);

async function main() {
  const rl = createInterface({
    input: createReadStream(SRC, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let header = null;
  const idx = {};
  /** @type {Map<string, Map<string, string>>} */
  const dict = new Map();

  for await (const line of rl) {
    if (!header) {
      header = line.split("\t");
      header.forEach((h, i) => {
        idx[h] = i;
      });
      continue;
    }
    const cols = line.split("\t");
    const ortho = cols[idx.ortho];
    const cgram = cols[idx.cgram];
    if (!ortho || SKIP_CGRAM.has(cgram)) continue;
    if (/[^a-zA-ZàáâäãåèéêëìíîïòóôöõùúûüýÿçñœŒæÆ'-]/.test(ortho)) continue;
    if (ortho.includes("'") || ortho.includes("-") || ortho.includes(" ")) continue;

    const key = fold(ortho);
    if (!/^[A-Z]+$/.test(key) || key.length < 2) continue;

    const genre = cols[idx.genre];
    const nombre = cols[idx.nombre];
    const infover = cols[idx.infover] || "";
    const kinds = kindFor(cgram, infover);

    let bucket = dict.get(key);
    if (!bucket) {
      bucket = new Map();
      dict.set(key, bucket);
    }
    for (const kind of kinds) {
      const code = encode(kind, genre, nombre);
      const token = `${ortho}:${code}`;
      bucket.set(token, token);
    }
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
    `Wrote ${keys.length} keys, ${json.length} bytes json, ${gz.length} bytes gzip`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
