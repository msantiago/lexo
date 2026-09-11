import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const ADMINS_FILE = path.join(dataDir, "admins.txt");

function splitList(raw: string | undefined) {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileAdmins(): string[] {
  try {
    return readFileSync(ADMINS_FILE, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

function adminTokens(): Set<string> {
  const tokens = new Set<string>();
  for (const item of [...splitList(process.env.LEXO_ADMIN_EMAILS), ...splitList(process.env.LEXO_ADMIN_IDS), ...fileAdmins()]) {
    tokens.add(item.toLowerCase());
  }
  return tokens;
}

export function isAdminUser(user: { id?: string | null; email?: string | null } | null | undefined) {
  if (!user) return false;
  const tokens = adminTokens();
  if (tokens.size === 0) return false;
  const email = user.email?.trim().toLowerCase();
  if (email && tokens.has(email)) return true;
  const id = user.id?.trim().toLowerCase();
  return Boolean(id && tokens.has(id));
}
