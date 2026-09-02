import { useEffect, type CSSProperties } from "react";

export type ScoreBurstItem = {
  id: number;
  points: number;
  letters: number;
  praise: string | null;
  x: number;
  y: number;
  arc: string;
  rotate: number;
  sparks: { id: number; dx: number; dy: number; delay: number }[];
};

const PRAISE = [
  "Génial !",
  "Excellent !",
  "Bravo !",
  "Superbe !",
  "Extra !",
  "Formidable !",
  "Magnifique !",
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

let nextId = 1;

export function createScoreBurst(points: number, letters: number): ScoreBurstItem {
  const x = rand(12, 88);
  const y = rand(28, 82);
  const sway = rand(70, 160) * (Math.random() < 0.5 ? -1 : 1);
  const rise = rand(210, 320);
  const endX = sway * rand(0.25, 0.55);
  const ctrlX = sway;
  const ctrlY = -rise * rand(0.42, 0.62);
  const sparkCount = letters >= 7 ? 8 : letters >= 6 ? 6 : 0;
  return {
    id: nextId++,
    points,
    letters,
    praise: letters >= 7 ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : null,
    x,
    y,
    arc: `M 0 0 Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${endX.toFixed(1)} ${(-rise).toFixed(1)}`,
    rotate: rand(-16, 16),
    sparks: Array.from({ length: sparkCount }, (_, i) => ({
      id: i,
      dx: rand(-50, 50),
      dy: rand(-90, -20),
      delay: rand(0, 0.18),
    })),
  };
}

function tier(letters: number) {
  if (letters >= 7) return "epic";
  if (letters >= 6) return "big";
  return "base";
}

function durationMs(letters: number) {
  if (letters >= 7) return 3200;
  if (letters >= 6) return 2800;
  return 2400;
}

type Props = {
  bursts: ScoreBurstItem[];
  onDone: (id: number) => void;
};

export default function ScoreBursts({ bursts, onDone }: Props) {
  return (
    <div className="score-bursts" aria-hidden>
      {bursts.map((burst) => (
        <Burst key={burst.id} burst={burst} onDone={onDone} />
      ))}
    </div>
  );
}

function Burst({
  burst,
  onDone,
}: {
  burst: ScoreBurstItem;
  onDone: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(burst.id), durationMs(burst.letters));
    return () => window.clearTimeout(timer);
  }, [burst.id, burst.letters, onDone]);

  const kind = tier(burst.letters);
  return (
    <span
      className={`score-burst score-burst--${kind}`}
      style={
        {
          left: `${burst.x}%`,
          top: `${burst.y}%`,
          offsetPath: `path("${burst.arc}")`,
          "--rot": `${burst.rotate}deg`,
        } as CSSProperties
      }
    >
      <span className="score-burst-pts">+{burst.points}</span>
      {burst.praise && <span className="score-burst-praise">{burst.praise}</span>}
      {burst.sparks.map((spark) => (
        <i
          key={spark.id}
          className="score-spark"
          style={
            {
              "--sx": `${spark.dx}px`,
              "--sy": `${spark.dy}px`,
              animationDelay: `${spark.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
