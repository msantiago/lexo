export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";
export const CREDITS_PATH = "/credits";

export function isPrivacyPath(path: string) {
  return path === "/privacy" || path === "/confidentialite";
}

export function isTermsPath(path: string) {
  return path === "/terms" || path === "/cgu" || path === "/conditions";
}

export function isCreditsPath(path: string) {
  return path === CREDITS_PATH;
}

export function isLegalPath(path: string) {
  return isPrivacyPath(path) || isTermsPath(path) || isCreditsPath(path);
}

export function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}
