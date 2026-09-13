import { PLAYER_COLORS } from "./types.ts";

export type AvatarPreset = {
  id: string;
  emoji: string;
  color: string;
  label: string;
};

export const LETTER_AVATAR_ID = "letter";
export const PHOTO_AVATAR_ID = "photo";
const PREFIX = "lexo:";

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "fox", emoji: "🦊", color: PLAYER_COLORS[0], label: "Renard" },
  { id: "owl", emoji: "🦉", color: PLAYER_COLORS[1], label: "Hibou" },
  { id: "cat", emoji: "🐱", color: PLAYER_COLORS[2], label: "Chat" },
  { id: "lion", emoji: "🦁", color: PLAYER_COLORS[3], label: "Lion" },
  { id: "panda", emoji: "🐼", color: PLAYER_COLORS[4], label: "Panda" },
  { id: "frog", emoji: "🐸", color: PLAYER_COLORS[5], label: "Grenouille" },
  { id: "octopus", emoji: "🐙", color: PLAYER_COLORS[6], label: "Pieuvre" },
  { id: "unicorn", emoji: "🦄", color: PLAYER_COLORS[7], label: "Licorne" },
  { id: "wolf", emoji: "🐺", color: PLAYER_COLORS[8], label: "Loup" },
  { id: "bee", emoji: "🐝", color: PLAYER_COLORS[9], label: "Abeille" },
  { id: "turtle", emoji: "🐢", color: PLAYER_COLORS[0], label: "Tortue" },
  { id: "butterfly", emoji: "🦋", color: PLAYER_COLORS[1], label: "Papillon" },
  { id: "star", emoji: "🌟", color: PLAYER_COLORS[2], label: "Étoile" },
  { id: "fire", emoji: "🔥", color: PLAYER_COLORS[3], label: "Flamme" },
  { id: "clover", emoji: "🍀", color: PLAYER_COLORS[4], label: "Trèfle" },
  { id: "moon", emoji: "🌙", color: PLAYER_COLORS[5], label: "Lune" },
  { id: "books", emoji: "📚", color: PLAYER_COLORS[6], label: "Livres" },
  { id: "dice", emoji: "🎲", color: PLAYER_COLORS[7], label: "Dé" },
  { id: "trophy", emoji: "🏆", color: PLAYER_COLORS[8], label: "Trophée" },
  { id: "coffee", emoji: "☕", color: PLAYER_COLORS[9], label: "Café" },
  { id: "grapes", emoji: "🍇", color: PLAYER_COLORS[0], label: "Raisin" },
  { id: "lemon", emoji: "🍋", color: PLAYER_COLORS[1], label: "Citron" },
  { id: "rocket", emoji: "🚀", color: PLAYER_COLORS[2], label: "Fusée" },
  { id: "music", emoji: "🎵", color: PLAYER_COLORS[3], label: "Musique" },
];

const BY_ID = new Map(AVATAR_PRESETS.map((preset) => [preset.id, preset]));

export function encodeAvatar(id: string): string {
  return `${PREFIX}${id}`;
}

export function parseAvatarId(image?: string | null): string {
  if (!image) return LETTER_AVATAR_ID;
  if (isAvatarImage(image)) return PHOTO_AVATAR_ID;
  if (!image.startsWith(PREFIX)) return LETTER_AVATAR_ID;
  const id = image.slice(PREFIX.length);
  if (id === LETTER_AVATAR_ID) return LETTER_AVATAR_ID;
  return BY_ID.has(id) ? id : LETTER_AVATAR_ID;
}

export function isAvatarImage(image?: string | null): boolean {
  if (!image) return false;
  return /^https?:\/\//i.test(image) || image.startsWith("/api/avatars/");
}

export function customAvatarSrc(userId: string, version?: number | string): string {
  const query = version != null && version !== "" ? `?v=${version}` : "";
  return `/api/avatars/${userId}${query}`;
}

export function avatarPreset(id: string): AvatarPreset | undefined {
  return BY_ID.get(id);
}
