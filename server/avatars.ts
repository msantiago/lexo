import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const avatarDir = path.resolve(here, "../data/avatars");
mkdirSync(avatarDir, { recursive: true });

const MAX_BYTES = 400_000;
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

export function isAvatarUserId(userId: string): boolean {
  return /^[a-f0-9]{16,64}$/i.test(userId);
}

function avatarPath(userId: string): string | null {
  if (!isAvatarUserId(userId)) return null;
  return path.join(avatarDir, `${userId.toLowerCase()}.jpg`);
}

function looksLikeImage(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  if (bytes.subarray(0, 3).equals(JPEG)) return true;
  if (bytes.subarray(0, 4).equals(PNG)) return true;
  return (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function parseAvatarDataUrl(raw: string): Buffer | null {
  const match = raw
    .trim()
    .match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([a-zA-Z0-9+/=\s]+)$/i);
  if (!match?.[1]) return null;
  const bytes = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) return null;
  if (!looksLikeImage(bytes)) return null;
  return bytes;
}

export function saveUserAvatar(userId: string, bytes: Buffer): boolean {
  const file = avatarPath(userId);
  if (!file) return false;
  writeFileSync(file, bytes);
  return true;
}

export function readUserAvatar(userId: string): Buffer | null {
  const file = avatarPath(userId);
  if (!file || !existsSync(file)) return null;
  return readFileSync(file);
}

export function hasUserAvatar(userId: string): boolean {
  const file = avatarPath(userId);
  return Boolean(file && existsSync(file));
}
