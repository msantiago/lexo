import type { Cell, PossibleWord, RoomView } from "@shared/types";
import WordLink from "../components/WordLink";
import LeaveButton from "../components/LeaveButton";
import { socket } from "../socket";

type Props = {
  room: RoomView;
  isHost: boolean;
  onNext: () => void;
  onLeave: () => void;
};

export default function Results({ room, isHost, onNext, onLeave }: Props) {
  const ranked = [...room.players].sort(
    (a, b) => b.totalScore - a.totalScore || b.roundScore - a.roundScore,
  );
  const solo = room.players.length === 1;
  const you = room.players.find((p) => p.id === room.you.id);
  const roundWinner = [...room.players].sort((a, b) => b.roundScore - a.roundScore)[0];
  const summary = room.summary;
  const rejected = summary?.rejected ?? [];

  return (
    <div className="screen results">
      <div className="results-head">
        <p className="times-up-label">Temps écoulé</p>
        <h1>{solo ? "Bien joué !" : `${roundWinner?.name} gagne la manche`}</h1>
        <p>
          {you ? (
            <>
              Cette manche : <b>{you.roundScore} pts</b> · Total : <b>{you.totalScore} pts</b>
            </>
          ) : null}
        </p>
      </div>

      <div className="results-layout">
        <div>
          <div className="results-board-row">
            {room.grid && <MiniGrid grid={room.grid} />}
            <div className="results-actions">
              {isHost ? (
                <button type="button" className="btn btn-gold" onClick={onNext}>
                  Manche suivante
                </button>
              ) : (
                <p className="hint">En attente de l’hôte pour la manche suivante…</p>
              )}
              <LeaveButton onLeave={onLeave} />
            </div>
          </div>
          <div className="podium" style={{ marginTop: 16 }}>
            {ranked.map((p, i) => (
              <div className={`podium-item ${p.id === you?.id ? "you" : ""}`} key={p.id}>
                <div className="rank">{i + 1}</div>
                <div className="avatar" style={{ background: p.color }}>
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>
                    {p.name}
                    {p.id === you?.id ? " (toi)" : ""}
                  </strong>
                  <div className="muted">
                    +{p.roundScore} cette manche · {p.wordCount} mot{p.wordCount > 1 ? "s" : ""}
                  </div>
                </div>
                <div
                  className="pts"
                  style={{
                    marginLeft: "auto",
                    fontFamily: "Fredoka, sans-serif",
                    fontSize: 28,
                    color: "var(--gold)",
                  }}
                >
                  {p.totalScore}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {summary && (
            <section className="card">
              <h2>Synthèse de la manche</h2>
              {summary.unique.length === 0 &&
                summary.shared.length === 0 &&
                rejected.length === 0 &&
                summary.missed.length === 0 && <p className="muted">Aucun mot trouvé.</p>}

              {summary.unique.length > 0 && (
                <>
                  <h3 className="recap-title">Mots uniques</h3>
                  <ul className="words recap-words">
                    {summary.unique.map((w) => (
                      <li key={w.key}>
                        <span>
                          <WordLink word={w.display} />
                          <small className="word-owner" style={{ color: w.color }}>
                            {" "}
                            {w.name}
                          </small>
                        </span>
                        <em>{w.points}</em>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {summary.shared.length > 0 && (
                <>
                  <h3 className="recap-title">Mots en commun (0 pt)</h3>
                  <ul className="words recap-words">
                    {summary.shared.map((w) => (
                      <li key={w.key} className="shared">
                        <span>
                          <WordLink word={w.display} />
                          <small className="word-owner">
                            {" "}
                            {w.names.map((n) => n.name).join(", ")}
                          </small>
                        </span>
                        <em>0</em>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {rejected.length > 0 && (
                <>
                  <h3 className="recap-title">Pas dans le dico (à vérifier)</h3>
                  <p className="muted recap-help">
                    Mots assez longs, chemin valide, mais absents du dictionnaire. Ouvre Larousse,
                    le Robert ou le Wiktionnaire pour vérifier, puis ajoute-le s’il est correct :
                    il compte pour cette manche et sera accepté ensuite.
                  </p>
                  <ul className="words recap-words">
                    {rejected.map((w) => (
                      <li key={w.key} className="rejected">
                        <span>
                          <WordLink word={w.display} />
                          <small className="word-owner">
                            {" "}
                            {w.names.map((n) => n.name).join(", ")}
                          </small>
                        </span>
                        {!w.added && (
                          <button
                            type="button"
                            className="chip on add-word"
                            onClick={() => socket.emit("dict:add", { key: w.key })}
                          >
                            Ajouter
                          </button>
                        )}
                        {w.added && <em className="added">ajouté</em>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {summary && (
            <MissedWords
              missed={summary.missed}
              possibleCount={summary.possibleCount}
              foundCount={summary.possibleCount - summary.missed.length}
            />
          )}

          {room.recap && (
            <section className="card" style={{ marginTop: 16 }}>
              <h2>Tous les mots</h2>
              {room.recap.map((block) => (
                <div key={block.playerId} className="recap-block">
                  <div className="recap-player">
                    <span className="avatar" style={{ background: block.color, width: 28, height: 28 }}>
                      {block.name.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>{block.name}</strong>
                    <span className="muted">
                      {block.words.length} mot{block.words.length > 1 ? "s" : ""} · {block.roundScore}{" "}
                      pts
                    </span>
                  </div>
                  <ul className="words recap-words">
                    {block.words.length === 0 && <li className="muted">Aucun mot</li>}
                    {block.words.map((w) => (
                      <li key={w.key} className={w.shared ? "shared" : ""}>
                        <span>
                          <WordLink word={w.display} />
                        </span>
                        <em>{w.points}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniGrid({ grid }: { grid: Cell[] }) {
  return (
    <div className="mini-board" aria-label="Grille de la manche">
      {grid.map((cell, i) => (
        <div key={i} className={`mini-die ${cell.letter === "QU" ? "qu" : ""}`}>
          <span className="die-face" style={{ transform: `rotate(${cell.rotation}deg)` }}>
            {cell.display}
          </span>
        </div>
      ))}
    </div>
  );
}

function MissedWords({
  missed,
  possibleCount,
  foundCount,
}: {
  missed: PossibleWord[];
  possibleCount: number;
  foundCount: number;
}) {
  const groups = new Map<number, PossibleWord[]>();
  for (const word of missed) {
    const list = groups.get(word.letters);
    if (list) list.push(word);
    else groups.set(word.letters, [word]);
  }
  const lengths = [...groups.keys()].sort((a, b) => b - a);

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Mots non trouvés</h2>
      <p className="muted recap-help">
        {foundCount} trouvé{foundCount > 1 ? "s" : ""} sur {possibleCount}{" "}
        possible{possibleCount > 1 ? "s" : ""} dans la grille
        {missed.length > 0
          ? ` · ${missed.length} oublié${missed.length > 1 ? "s" : ""}`
          : ""}
        . Les points indiqués auraient été gagnés si le mot était unique.
      </p>
      {missed.length === 0 && possibleCount > 0 ? (
        <p>Tous les mots de la grille ont été trouvés. Bravo !</p>
      ) : missed.length === 0 ? (
        <p className="muted">Aucun mot possible avec ces règles.</p>
      ) : (
        <div className="missed-scroll">
          {lengths.map((n) => (
            <div key={n}>
              <h3 className="recap-title">
                {n} lettre{n > 1 ? "s" : ""} · {groups.get(n)!.length}
              </h3>
              <ul className="words recap-words">
                {groups.get(n)!.map((w) => (
                  <li key={w.key}>
                    <span>
                      <WordLink word={w.display} />
                    </span>
                    <em>{w.points}</em>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
