const KEY = "lexo:sound";
const EVENT = "lexo:sound";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

export function subscribeSound(listener: (on: boolean) => void) {
  const onCustom = (event: Event) => listener(Boolean((event as CustomEvent<boolean>).detail));
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener(soundEnabled());
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
