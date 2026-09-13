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

function postJson(url: string, body: unknown, label: string) {
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
  }).catch((err) => {
    console.error(`Alerte ${label} impossible :`, err instanceof Error ? err.message : err);
  });
}

function notifyTelegram(title: string, body: string) {
  const token = process.env.LEXO_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.LEXO_TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const appUrl = process.env.BETTER_AUTH_URL?.trim();
  const text = appUrl ? `${title}\n${body}\n${appUrl}` : `${title}\n${body}`;
  postJson(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text }, "Telegram");
}

function notifyNtfy(title: string, body: string) {
  const url = alertUrl();
  if (!url) return;

  const headers: Record<string, string> = {
    Title: title,
    Tags: "game_die",
    "X-Priority": "high",
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
  const title = "Nouveau salon Lexo";
  const body = `${room.hostName} a créé le salon ${room.code}`;
  notifyTelegram(title, body);
  notifyNtfy(title, body);
}
