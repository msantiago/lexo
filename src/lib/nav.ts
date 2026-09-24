export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";
export const CREDITS_PATH = "/credits";
export const CONTACT_PATH = "/contact";
export const SIGN_IN_PATH = "/connexion";
export const SIGN_UP_PATH = "/inscription";

export function isPrivacyPath(path: string) {
  return path === "/privacy" || path === "/confidentialite";
}

export function isTermsPath(path: string) {
  return path === "/terms" || path === "/cgu" || path === "/conditions";
}

export function isCreditsPath(path: string) {
  return path === CREDITS_PATH;
}

export function isContactPath(path: string) {
  return path === CONTACT_PATH;
}

export function isSignInPath(path: string) {
  return path === SIGN_IN_PATH || path === "/login";
}

export function isSignUpPath(path: string) {
  return path === SIGN_UP_PATH || path === "/signup";
}

export function isAuthPath(path: string) {
  return isSignInPath(path) || isSignUpPath(path);
}

export function isLegalPath(path: string) {
  return (
    isPrivacyPath(path) ||
    isTermsPath(path) ||
    isCreditsPath(path) ||
    isContactPath(path) ||
    isAuthPath(path)
  );
}

export function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}
