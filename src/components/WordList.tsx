import { AnimatePresence, motion } from "framer-motion";
import { wordPoints } from "@shared/dice";
import type { FoundWord } from "@shared/types";

export default function WordList({
  words,
  title,
  accent,
}: {
  words: FoundWord[];
  title?: string;
  accent?: string;
}) {
  const total = words.reduce((sum, w) => sum + w.points, 0);
  return (
    <aside className="word-list" style={accent ? { borderColor: accent } : undefined}>
      <h3>{title ?? `Tes mots · ${words.length} · ${total} pts`}</h3>
      {words.length === 0 ? (
        <p className="muted">Aucun mot pour l’instant.</p>
      ) : (
        <div className="recap-table-wrap word-live">
          <table className="recap-table">
            <tbody>
              <AnimatePresence initial={false}>
                {words.map((word) => {
                  const pts = word.shared ? wordPoints(word.letters, false) : word.points;
                  return (
                    <motion.tr
                      layout
                      key={word.key}
                      className={word.shared ? "shared" : undefined}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    >
                      <td>{word.display}</td>
                      <motion.td
                        className={`recap-pts${word.shared ? " dim" : ""}`}
                        key={`${word.key}-${pts}-${word.shared ? "shared" : "own"}`}
                      >
                        {pts}
                      </motion.td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
}
