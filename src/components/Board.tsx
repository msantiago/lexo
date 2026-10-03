import { useEffect, useMemo, useRef, useState } from "react";
import { letterNeedsBaseMark } from "@shared/dice";
import type { Cell } from "@shared/types";
import { playLetterBack, playLetterSelect } from "../lib/sfx";

type Flash = "success" | "fail" | null;

type Props = {
  grid: Cell[];
  path: number[];
  flash: Flash;
  disabled?: boolean;
  shuffling?: boolean;
  revealing?: boolean;
  accent?: string;
  onPathChange: (path: number[]) => void;
  onSubmit: (path: number[]) => void;
};

/** Fraction of the die size used as hit-circle radius (center only). */
const HIT_RADIUS = 0.38;

/** Must match `.board` padding/gap in index.css (percent of the board). */
const BOARD_PAD = 4;
const BOARD_GAP = 3.4;

function dieCenter(index: number): { x: number; y: number } {
  const cell = (100 - BOARD_PAD * 2 - BOARD_GAP * 3) / 4;
  const row = Math.floor(index / 4);
  const col = index % 4;
  return {
    x: BOARD_PAD + col * (cell + BOARD_GAP) + cell / 2,
    y: BOARD_PAD + row * (cell + BOARD_GAP) + cell / 2,
  };
}

function cellFromPoint(x: number, y: number, dice: HTMLElement[]): number | null {
  let best: { index: number; dist: number } | null = null;
  for (const die of dice) {
    const r = die.getBoundingClientRect();
    const dist = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    const radius = Math.min(r.width, r.height) * HIT_RADIUS;
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { index: Number(die.dataset.cell), dist };
    }
  }
  return best ? best.index : null;
}

const SHUFFLE_FACES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Qu"];

function nextGap(kind: number) {
  if (kind < 0.34) return 240 + Math.random() * 220;
  if (kind < 0.67) return 360 + Math.random() * 300;
  return 500 + Math.random() * 460;
}

/** Uneven instants across the last second, then shuffled so the dice settle in a random order. */
function revealDelays(count: number): number[] {
  const weights = Array.from({ length: count }, () => 0.35 + Math.random());
  const sum = weights.reduce((total, weight) => total + weight, 0);
  let cursor = Math.random() * 70;
  const times = weights.map((weight) => {
    const at = cursor;
    cursor += (weight / sum) * 760;
    return Math.round(at);
  });
  for (let i = times.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = times[i];
    times[i] = times[j];
    times[j] = swap;
  }
  return times;
}

function DieTile({
  cell,
  index,
  shuffling,
  settleDelay,
  active,
  current,
  flash,
}: {
  cell: Cell;
  index: number;
  shuffling: boolean;
  settleDelay: number | null;
  active: boolean;
  current: boolean;
  flash: Flash;
}) {
  const [face, setFace] = useState(cell.display);
  const [settled, setSettled] = useState(false);
  const kind = useRef(Math.random());

  useEffect(() => {
    if (!shuffling) return;
    setSettled(false);
    let timer = 0;
    let lockTimer = 0;
    const roll = () => {
      setFace(SHUFFLE_FACES[Math.floor(Math.random() * SHUFFLE_FACES.length)]);
      timer = window.setTimeout(roll, nextGap(kind.current));
    };
    const start = window.setTimeout(roll, Math.random() * 280);
    if (settleDelay != null) {
      lockTimer = window.setTimeout(() => {
        window.clearTimeout(start);
        window.clearTimeout(timer);
        setSettled(true);
      }, settleDelay);
    }
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timer);
      window.clearTimeout(lockTimer);
    };
  }, [shuffling, settleDelay]);

  const shown = !shuffling || settled ? cell.display : face;
  const spinning = shuffling && !settled;
  return (
    <div
      data-cell={index}
      className={[
        "die",
        spinning ? "is-spinning" : "",
        !shuffling && cell.letter === "QU" ? "qu" : "",
        active ? "active" : "",
        current ? "current" : "",
        flash && active ? flash : "",
      ].join(" ")}
    >
      <span
        className={[
          "die-face",
          shown === "Qu" ? "qu" : "",
          letterNeedsBaseMark(shown) ? "marked" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ transform: `rotate(${cell.rotation}deg)` }}
      >
        {shown}
      </span>
    </div>
  );
}

export default function Board({
  grid,
  path,
  flash,
  disabled,
  shuffling = false,
  revealing = false,
  accent,
  onPathChange,
  onSubmit,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const feltRef = useRef<HTMLDivElement>(null);
  const revealPlan = useRef<number[] | null>(null);
  if (!shuffling) revealPlan.current = null;
  if (revealing && shuffling && revealPlan.current == null) revealPlan.current = revealDelays(grid.length);
  const drawing = useRef(false);
  const pathRef = useRef(path);
  const disabledRef = useRef(disabled);
  const onPathChangeRef = useRef(onPathChange);
  const onSubmitRef = useRef(onSubmit);
  pathRef.current = path;
  disabledRef.current = disabled;
  onPathChangeRef.current = onPathChange;
  onSubmitRef.current = onSubmit;

  const points = useMemo(() => path.map(dieCenter), [path]);

  useEffect(() => {
    const felt = feltRef.current;
    if (!felt) return;
    if (flash !== "fail") {
      felt.classList.remove("is-reject");
      return;
    }
    felt.classList.remove("is-reject");
    void felt.offsetWidth;
    felt.classList.add("is-reject");
  }, [flash]);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;

    const dice = () => [...root.querySelectorAll<HTMLElement>("[data-cell]")];

    const setPath = (next: number[]) => {
      pathRef.current = next;
      onPathChangeRef.current(next);
    };

    const extend = (index: number) => {
      const current = pathRef.current;
      if (current[current.length - 1] === index) return;
      if (current.length >= 2 && current[current.length - 2] === index) {
        setPath(current.slice(0, -1));
        playLetterBack();
        return;
      }
      if (current.includes(index)) return;
      if (current.length === 0) {
        setPath([index]);
        playLetterSelect(1);
        return;
      }
      const last = current[current.length - 1];
      const lr = Math.floor(last / 4);
      const lc = last % 4;
      const nr = Math.floor(index / 4);
      const nc = index % 4;
      if (Math.max(Math.abs(lr - nr), Math.abs(lc - nc)) === 1) {
        const next = [...current, index];
        setPath(next);
        playLetterSelect(next.length);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (disabledRef.current) return;
      const index = cellFromPoint(e.clientX, e.clientY, dice());
      if (index === null) return;
      e.preventDefault();
      drawing.current = true;
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* Safari can reject capture; drawing still works via target events */
      }
      setPath([index]);
      playLetterSelect(1);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drawing.current || disabledRef.current) return;
      e.preventDefault();
      const index = cellFromPoint(e.clientX, e.clientY, dice());
      if (index === null) return;
      extend(index);
    };

    const finish = (submit: boolean) => {
      if (!drawing.current) return;
      drawing.current = false;
      const current = pathRef.current;
      if (submit && current.length) onSubmitRef.current(current);
    };

    const onPointerUp = () => finish(true);
    const onPointerCancel = () => finish(false);

    root.addEventListener("pointerdown", onPointerDown, { passive: false });
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerCancel);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  const stroke = accent || "#f0d78c";
  const strokeSoft = accent || "rgba(15, 61, 56, 0.5)";

  return (
    <div ref={wrapRef} className="board-wrap" style={accent ? { ["--path-accent" as string]: accent } : undefined}>
      <div ref={feltRef} className={`board${flash === "fail" ? " is-reject" : ""}`}>
        {grid.map((cell, i) => (
          <DieTile
            key={i}
            cell={cell}
            index={i}
            shuffling={shuffling}
            settleDelay={revealing ? (revealPlan.current?.[i] ?? null) : null}
            active={path.includes(i)}
            current={path[path.length - 1] === i}
            flash={flash}
          />
        ))}
      </div>
      <svg className="board-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {points.length > 1 && (
          <>
            <polyline
              points={line}
              fill="none"
              stroke={accent ? `${stroke}99` : strokeSoft}
              strokeWidth="5.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={line}
              fill="none"
              stroke={stroke}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 3.6 : 2.4}
            fill={i === points.length - 1 ? "#fff6ea" : stroke}
          />
        ))}
      </svg>
    </div>
  );
}
