import { createAuthClient } from "better-auth/react";
import type { AuthProviderId } from "@shared/account";
import { socket } from "../socket";

export const authClient = createAuthClient();

export function refreshSocketAuth() {
  socket.disconnect();
  socket.connect();
}

export function sanitizePseudo(raw?: string | null): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 16);
}

export function displayNameFromUser(name?: string | null, email?: string | null): string {
  const fromName = sanitizePseudo(name);
  if (fromName) return fromName;
  const local = (email ?? "").split("@")[0] ?? "";
  return sanitizePseudo(local) || "Joueur";
}

export const SOCIAL_PROVIDERS: { id: AuthProviderId; label: string }[] = [
  { id: "google", label: "Continuer avec Google" },
  { id: "apple", label: "Continuer avec Apple" },
  { id: "facebook", label: "Continuer avec Facebook" },
  { id: "microsoft", label: "Continuer avec Microsoft" },
  { id: "github", label: "Continuer avec GitHub" },
  { id: "discord", label: "Continuer avec Discord" },
];

export const AUTH_ERRORS: Record<string, string> = {
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cet e-mail.",
  FAILED_TO_CREATE_USER: "Impossible de créer le compte. Réessaie dans un instant.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe incorrect.",
  INVALID_EMAIL: "E-mail invalide.",
  PASSWORD_TOO_SHORT: "Mot de passe trop court (8 caractères minimum).",
  INVALID_PASSWORD: "Mot de passe invalide.",
};

export function authErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Une erreur est survenue.";
  if (error.code && AUTH_ERRORS[error.code]) return AUTH_ERRORS[error.code];
  return error.message || "Une erreur est survenue.";
}
