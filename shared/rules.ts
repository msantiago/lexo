import { DIFFICULTY_OPTIONS, type GameSettings, type GridDifficulty, type Phase } from "./types.ts";

function durationPhrase(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} secondes`;
  if (s === 0) return m === 1 ? "1 minute" : `${m} minutes`;
  return `${m} min ${s.toString().padStart(2, "0")}`;
}

export function difficultyLabel(id: GridDifficulty): string {
  return DIFFICULTY_OPTIONS.find((option) => option.id === id)?.label ?? "Moyen";
}

function difficultyPhrase(id: GameSettings["difficulty"]): string {
  if (id === "medium") return "moyenne";
  return difficultyLabel(id).toLowerCase();
}

function formesPhrase(settings: GameSettings): string {
  if (settings.allowPlurals && settings.allowFeminines) return "pluriels et féminins acceptés";
  if (settings.allowPlurals) return "pluriels acceptés, féminins interdits";
  if (settings.allowFeminines) return "féminins acceptés, pluriels interdits";
  return "sans pluriels ni féminins";
}

function verbsPhrase(settings: GameSettings): string {
  if (settings.conjugations === "all") return "toutes les conjugaisons autorisées";
  const parts: string[] = [];
  if (settings.allowPastParticiple) parts.push("passé");
  if (settings.allowPresentParticiple) parts.push("présent");
  if (parts.length === 2) return "participes passé et présent uniquement";
  if (parts[0] === "passé") return "participe passé uniquement";
  if (parts[0] === "présent") return "participe présent uniquement";
  return "participes uniquement";
}

/** Une phrase lisible pour les joueurs qui ne choisissent pas les règles. */
export function summarizeRules(settings: GameSettings): string {
  return (
    `Manche de ${durationPhrase(settings.durationSec)}, ` +
    `grille ${difficultyPhrase(settings.difficulty)}, ` +
    `mots d’au moins ${settings.minLetters} lettres, ` +
    `${settings.letterOrientation === "shuffle" ? "lettres tournées au hasard" : "lettres à l’endroit"}, ` +
    `${formesPhrase(settings)}, ` +
    `${verbsPhrase(settings)}.`
  );
}

export function phaseLabel(phase: Phase): string {
  return phase === "lobby" ? "En attente de joueurs" : "Partie commencée";
}
