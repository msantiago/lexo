import { formatTime } from "../lib/format";

type Props = {
  remainingMs: number;
  totalMs: number;
};

export default function Timer({ remainingMs, totalMs }: Props) {
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const urgent = remainingMs <= 10_000;
  return (
    <div className={`timer ${urgent ? "urgent" : ""}`} aria-label="Chronomètre">
      <svg viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={r} fill="none" stroke="rgba(255,246,234,0.12)" strokeWidth="8" />
        <circle
          cx="59"
          cy="59"
          r={r}
          fill="none"
          stroke={urgent ? "#ff5d4a" : "#e8b84a"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <div className="time">{formatTime(remainingMs)}</div>
    </div>
  );
}
