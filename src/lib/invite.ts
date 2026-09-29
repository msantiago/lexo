const INVITE_KEY = "lexo:invite";
const INVITE_PATH = /^\/salon\/([A-Za-z]{4})\/?$/;

export function inviteUrl(code: string): string {
  return `${window.location.origin}/salon/${code.toUpperCase()}`;
}

export function inviteCodeFromPath(path: string): string | null {
  const match = INVITE_PATH.exec(path);
  return match ? match[1].toUpperCase() : null;
}

export function takeInviteFromUrl(): string | null {
  const code = inviteCodeFromPath(window.location.pathname);
  if (code) {
    window.history.replaceState({}, "", "/");
    try {
      sessionStorage.setItem(INVITE_KEY, code);
    } catch {
      /* ignore quota / private mode */
    }
    return code;
  }
  try {
    return sessionStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearInvite() {
  try {
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}
