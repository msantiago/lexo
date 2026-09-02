import { AnimatePresence, motion } from "framer-motion";
import type { FoundWord } from "@shared/types";

export default function WordList({ words }: { words: FoundWord[] }) {
  const total = words.reduce((sum, w) => sum + w.points, 0);
  return (
    <aside className="word-list">
      <h3>
        Tes mots · {words.length} · {total} pts
      </h3>
      <ul className="words">
        <AnimatePresence initial={false}>
          {words.map((word) => (
            <motion.li
              layout
              key={word.key}
              className={word.shared ? "shared new" : "new"}
              initial={{ opacity: 0, x: 28, scale: 0.86 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
              <span>{word.display}</span>
              <motion.em
                key={word.points}
                initial={{ scale: 1.5, color: "#6fdb9a" }}
                animate={{ scale: 1 }}
              >
                {word.points}
              </motion.em>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </aside>
  );
}
