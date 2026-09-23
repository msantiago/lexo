import type { DirectoryPlay } from "@shared/account";
import type { Phase } from "@shared/types";

export function phaseShort(phase: Phase): string {
  if (phase === "playing") return "en cours";
  if (phase === "results") return "résultats";
  return "en attente";
}

export function activityLabel(play: DirectoryPlay | null, online: boolean): string | null {
  if (!play) return online ? "Au menu" : null;
  const where = play.mode === "solo" ? "Solo" : "Salon";
  const prefix = play.observing ? "Observe · " : "";
  return `${prefix}${where} · ${phaseShort(play.phase)}`;
}

export function formatJoined(ts: number): string {
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
