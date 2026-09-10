import "./crypto-polyfill.ts";
import { randomBytes } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { fromNodeHeaders } from "better-auth/node";
import Database from "better-sqlite3";
import { importPKCS8, SignJWT } from "jose";
import type { AuthProviders } from "../shared/account.ts";
import { awardWelcome } from "./store.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../data");
mkdirSync(dataDir, { recursive: true });

const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const appleReady = Boolean(
  process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY,
);
const facebookReady = Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET);
const microsoftReady = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
const githubReady = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const discordReady = Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);

export const authProviders: AuthProviders = {
  google: googleReady,
  apple: appleReady,
  facebook: facebookReady,
  microsoft: microsoftReady,
  github: githubReady,
  discord: discordReady,
};

function firstName(profileName: string | undefined | null, email: string | undefined | null): string {
  const fromName = (profileName ?? "").trim().split(/\s+/)[0] ?? "";
  if (fromName) return fromName.slice(0, 16);
  const local = (email ?? "").split("@")[0] ?? "";
  return (local || "Joueur").slice(0, 16);
}

async function appleClientSecret(): Promise<string> {
  const clientId = process.env.APPLE_CLIENT_ID!;
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
}

const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};

if (googleReady) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    prompt: "select_account",
    mapProfileToUser: (profile) => ({
      name: firstName(profile.name, profile.email),
    }),
  };
}

if (appleReady) {
  socialProviders.apple = async () => ({
    clientId: process.env.APPLE_CLIENT_ID!,
    clientSecret: await appleClientSecret(),
    mapProfileToUser: (profile) => ({
      name: firstName(
        typeof profile.name === "string" ? profile.name : undefined,
        profile.email,
      ),
    }),
  });
}

if (facebookReady) {
  socialProviders.facebook = {
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    mapProfileToUser: (profile) => ({
      name: firstName(profile.name, "email" in profile ? profile.email : undefined),
    }),
  };
}

if (microsoftReady) {
  socialProviders.microsoft = {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    tenantId: "common",
    mapProfileToUser: (profile) => ({
      name: firstName(
        profile.given_name || profile.name,
        profile.email || profile.preferred_username,
      ),
    }),
  };
}

if (githubReady) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    mapProfileToUser: (profile) => ({
      name: firstName(profile.name || profile.login, profile.email),
    }),
  };
}

if (discordReady) {
  socialProviders.discord = {
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    mapProfileToUser: (profile) => ({
      name: firstName(profile.global_name || profile.username, profile.email),
    }),
  };
}

const extraOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const secret =
  process.env.BETTER_AUTH_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "lexo-dev-secret-change-me-32chars!");

if (!secret || secret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET manquant ou trop court (32 caractères min.). Ajoute-le dans .env",
  );
}

export const auth = betterAuth({
  secret,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
  database: new Database(path.join(dataDir, "auth.sqlite")),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  advanced: {
    database: {
      generateId: () => randomBytes(16).toString("hex"),
    },
  },
  socialProviders,
  trustedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://appleid.apple.com",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...extraOrigins,
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          awardWelcome(user.id);
        },
      },
    },
  },
});

export async function migrateAuth() {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

export async function sessionFromHeaders(headers: IncomingHttpHeaders) {
  return auth.api.getSession({ headers: fromNodeHeaders(headers) });
}
