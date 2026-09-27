import { useMemo } from "react";

const LETTERS = "LEXOABCDEFGHILMNOPRSTU".split("");
const COUNT = 16;

function randomFrom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export default function FloatingLetters() {
  const items = useMemo(() => {
    const random = randomFrom(0x4c45584f);
    const slots = Array.from({ length: COUNT }, (_, index) => index);
    for (let index = COUNT - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      const slot = slots[index];
      slots[index] = slots[swap];
      slots[swap] = slot;
    }
    return slots.map((slot, index) => {
      const duration = 30 + random() * 18;
      const span = 86 / COUNT;
      const left = 4 + slot * span + random() * span;
      return {
        id: index,
        ch: LETTERS[Math.floor(random() * LETTERS.length)],
        left: `${left.toFixed(2)}%`,
        delay: `${(-random() * duration).toFixed(2)}s`,
        duration: `${duration.toFixed(2)}s`,
        size: `${(20 + random() * 28).toFixed(1)}px`,
        sway: `${((random() - 0.5) * 42).toFixed(1)}px`,
      };
    });
  }, []);

  return (
    <div className="floating-letters" aria-hidden>
      {items.map((item) => (
        <span
          key={item.id}
          style={{
            left: item.left,
            animationDelay: item.delay,
            animationDuration: item.duration,
            fontSize: item.size,
            ["--sway" as string]: item.sway,
          }}
        >
          {item.ch}
        </span>
      ))}
    </div>
  );
}
