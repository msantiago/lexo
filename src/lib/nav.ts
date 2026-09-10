export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";

export function isPrivacyPath(path: string) {
  return path === "/privacy" || path === "/confidentialite";
}

export function isTermsPath(path: string) {
  return path === "/terms" || path === "/cgu" || path === "/conditions";
}

export function isLegalPath(path: string) {
  return isPrivacyPath(path) || isTermsPath(path);
}

export function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}
