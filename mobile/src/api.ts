/** Backend URL for the mobile client (same Express + Socket.IO server as web). */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:3001";
}

/** Authenticated fetch using the Better Auth cookie from SecureStore. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  try {
    const { authClient } = await import("./auth-client");
    const cookie = await authClient.getCookie();
    if (cookie) headers.set("cookie", cookie);
  } catch {
    /* guest */
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const url = path.startsWith("http")
    ? path
    : `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, headers });
}
