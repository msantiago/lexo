import { formatTime } from "../lib/format";

type Props = {
  remainingMs: number;
  totalMs: number;
};

export default function Timer({ remainingMs, totalMs }: Props) {
  const ratio = Math.min(1, Math.max(0, totalMs > 0 ? remainingMs / totalMs : 0));
  const urgent = remainingMs <= 10_000;
  return (
    <div
      className={`timer${urgent ? " urgent" : ""}`}
      role="timer"
      aria-label={`Temps restant ${formatTime(remainingMs)}`}
      aria-valuemin={0}
      aria-valuemax={Math.round(totalMs / 1000)}
      aria-valuenow={Math.max(0, Math.ceil(remainingMs / 1000))}
    >
      <div className="timer-track">
        <div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} />
        <span className="timer-time">{formatTime(remainingMs)}</span>
      </div>
    </div>
  );
}
