import { useMemo } from "react";

const LETTERS = "LEXOABCDEFGHILMNOPRSTU".split("");

export default function FloatingLetters() {
  const items = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        ch: LETTERS[i % LETTERS.length],
        left: `${(i * 17) % 100}%`,
        delay: `${(i * 0.7) % 12}s`,
        duration: `${16 + (i % 7)}s`,
        size: `${28 + (i % 5) * 10}px`,
      })),
    [],
  );
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
            top: "40%",
          }}
        >
          {item.ch}
        </span>
      ))}
    </div>
  );
}
