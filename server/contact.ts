import type { Request } from "express";
import { notifyContact } from "./alert.ts";
import { saveContactMessage } from "./store.ts";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

export type ContactKind = "bug" | "idea";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export function submitContact(
  body: unknown,
  ip: string,
  userId: string | null,
): { ok: true } | { error: string; status: number } {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (clean(payload.website, 200)) return { ok: true };

  const kind = payload.kind === "idea" ? "idea" : payload.kind === "bug" ? "bug" : null;
  const name = clean(payload.name, 40);
  const email = clean(payload.email, 120);
  const message = clean(payload.message, 2000);

  if (!kind) return { error: "Choisis un bug ou une idée.", status: 400 };
  if (name.length < 1) return { error: "Indique ton nom.", status: 400 };
  if (!EMAIL_RE.test(email)) return { error: "Indique un e-mail valide.", status: 400 };
  if (message.length < 10) return { error: "Le message est un peu court.", status: 400 };
  if (tooMany(ip)) {
    return { error: "Trop de messages pour le moment. Réessaie un peu plus tard.", status: 429 };
  }

  saveContactMessage({ kind, name, email, message, userId });
  notifyContact({ kind, name, email, message });
  return { ok: true };
}
