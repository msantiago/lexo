const ALERT_TIMEOUT_MS = 4_000;

function alertUrl() {
  const raw = process.env.LEXO_ALERT_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function postAlert(title: string, body: string) {
  const url = alertUrl();
  if (!url) return;

  const headers: Record<string, string> = {
    Title: title,
    Tags: "game_die",
    Priority: "default",
  };
  const token = process.env.LEXO_ALERT_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const click = process.env.BETTER_AUTH_URL?.trim();
  if (click) headers.Click = click;

  void fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
  }).catch((err) => {
    console.error("Alerte ntfy impossible :", err instanceof Error ? err.message : err);
  });
}

export function notifyRoomCreated(room: { code: string; solo: boolean; hostName: string }) {
  if (room.solo) return;
  postAlert("Nouveau salon Lexo", `${room.hostName} a créé le salon ${room.code}`);
}
