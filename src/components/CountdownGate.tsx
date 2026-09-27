import { useEffect, type ReactNode } from "react";
import { COUNTDOWN_STEPS, countdownIndex } from "@shared/countdown";
import { playCountdownSound, unlockAudio } from "../lib/sfx";

const playedBeat = new Map<number, number>();

type Props = {
  startedAt: number | null;
  now: number;
  children: ReactNode;
};

export default function CountdownGate({ startedAt, now, children }: Props) {
  const index = startedAt == null ? null : countdownIndex(startedAt, now);
  const label = index == null ? null : COUNTDOWN_STEPS[index];
  const go = label === "GO!";

  useEffect(() => {
    if (startedAt == null || index == null) return;
    if (playedBeat.get(startedAt) === index) return;
    playedBeat.set(startedAt, index);
    if (playedBeat.size > 8) {
      const oldest = playedBeat.keys().next().value;
      if (oldest != null) playedBeat.delete(oldest);
    }
    unlockAudio();
    playCountdownSound(index);
  }, [startedAt, index]);

  return (
    <div className={`countdown-gate${index != null ? " is-counting" : ""}`}>
      {children}
      {label && (
        <div className="countdown-overlay" aria-live="assertive">
          <span key={label} className={`countdown-puff${go ? " is-go" : ""}`}>
            <span className="countdown-smoke">{label}</span>
            <span className="countdown-smoke is-haze" aria-hidden="true">
              {label}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
