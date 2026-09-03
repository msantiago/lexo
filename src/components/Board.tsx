import { useEffect, useMemo, useRef } from "react";
import type { Cell } from "@shared/types";
import { playLetterBack, playLetterSelect } from "../lib/sfx";

type Flash = "success" | "fail" | null;

type Props = {
  grid: Cell[];
  path: number[];
  flash: Flash;
  disabled?: boolean;
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

export default function Board({
  grid,
  path,
  flash,
  disabled,
  onPathChange,
  onSubmit,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={wrapRef} className="board-wrap">
      <div className="board">
        {grid.map((cell, i) => (
          <div
            key={i}
            data-cell={i}
            className={[
              "die",
              cell.letter === "QU" ? "qu" : "",
              path.includes(i) ? "active" : "",
              path[path.length - 1] === i ? "current" : "",
              flash && path.includes(i) ? flash : "",
            ].join(" ")}
            style={{ animationDelay: `${i * 32}ms` }}
          >
            <span className="die-face" style={{ transform: `rotate(${cell.rotation}deg)` }}>
              {cell.display}
            </span>
          </div>
        ))}
      </div>
      <svg className="board-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {points.length > 1 && (
          <>
            <polyline
              points={line}
              fill="none"
              stroke="rgba(15, 61, 56, 0.5)"
              strokeWidth="5.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={line}
              fill="none"
              stroke="#f0d78c"
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
            fill={i === points.length - 1 ? "#fff6ea" : "#e8b84a"}
          />
        ))}
      </svg>
    </div>
  );
}
