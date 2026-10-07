import type { WordFailReason } from "@shared/types";

export const FAIL_MESSAGES: Record<WordFailReason, string> = {
  "too-short": "Trop court",
  unknown: "Pas dans le dico",
  plural: "Pluriel interdit",
  feminine: "Féminin (adj./verbe) interdit",
  conjugation: "Conjugaison interdite",
  duplicate: "Déjà trouvé",
  path: "Chemin invalide",
  phase: "C'est terminé",
};

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}
