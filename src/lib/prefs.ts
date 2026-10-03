const SHOW_OTHER_SCORES_KEY = "lexo:showOtherScores";
const FOUND_WORD_ORDER_KEY = "lexo:foundWordOrder";
const FOUND_WORD_ORDER_EVENT = "lexo:found-word-order";

export type FoundWordOrder = "letters" | "entry" | "alpha";

const FOUND_WORD_ORDERS = new Set<FoundWordOrder>(["letters", "entry", "alpha"]);

export function loadFoundWordOrder(): FoundWordOrder {
  try {
    const raw = localStorage.getItem(FOUND_WORD_ORDER_KEY);
    if (raw === "entry" || raw === "alpha" || raw === "letters") return raw;
    return "letters";
  } catch {
    return "letters";
  }
}

export function saveFoundWordOrder(value: FoundWordOrder) {
  try {
    localStorage.setItem(FOUND_WORD_ORDER_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(FOUND_WORD_ORDER_EVENT, { detail: value }));
}

export function onFoundWordOrder(listener: (value: FoundWordOrder) => void) {
  const onChange = (event: Event) => {
    const value = (event as CustomEvent<FoundWordOrder>).detail;
    if (FOUND_WORD_ORDERS.has(value)) listener(value);
  };
  window.addEventListener(FOUND_WORD_ORDER_EVENT, onChange);
  return () => window.removeEventListener(FOUND_WORD_ORDER_EVENT, onChange);
}

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
