export const COUNTDOWN_STEPS = ["5", "4", "3", "2", "1", "GO!"] as const;
export const COUNTDOWN_STEP_MS = 1000;
export const COUNTDOWN_MS = COUNTDOWN_STEPS.length * COUNTDOWN_STEP_MS;

/** True while the dice should cycle letters. Stops as soon as GO! appears. */
export function countdownShuffling(startedAt: number, now = Date.now()): boolean {
  const index = countdownIndex(startedAt, now);
  return index != null && COUNTDOWN_STEPS[index] !== "GO!";
}

/** True during the last second before GO!, when the real grid is revealed die by die. */
export function countdownRevealing(startedAt: number, now = Date.now()): boolean {
  const index = countdownIndex(startedAt, now);
  return index != null && COUNTDOWN_STEPS[index] === "1";
}

/** Index of the current beat, or null once the grid is playable. */
export function countdownIndex(startedAt: number, now = Date.now()): number | null {
  const elapsed = now - startedAt;
  if (elapsed >= COUNTDOWN_MS) return null;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / COUNTDOWN_STEP_MS);
}

export function roundEndsAt(startedAt: number, durationMs: number): number {
  return startedAt + COUNTDOWN_MS + durationMs;
}
