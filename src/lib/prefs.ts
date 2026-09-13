const SHOW_OTHER_SCORES_KEY = "lexo:showOtherScores";

export function loadShowOtherScores(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_OTHER_SCORES_KEY);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function saveShowOtherScores(value: boolean) {
  try {
    localStorage.setItem(SHOW_OTHER_SCORES_KEY, value ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
