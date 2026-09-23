import type {
  Cell,
  PossibleWord,
  RoundSummary,
  RoomView,
  SharedWord,
  SummaryWord,
  WordLike,
} from "@shared/types";
import { wordPoints } from "@shared/dice";
import WordLink from "../components/WordLink";
import LeaveButton from "../components/LeaveButton";
import RoundChat from "../components/RoundChat";
import { socket } from "../socket";

type Props = {
  room: RoomView;
  isHost: boolean;
  admin?: boolean;
  onNext: () => void;
  onLeave: () => void;
  onCloseRoom?: () => void;
};

export default function Results({ room, isHost, admin, onNext, onLeave, onCloseRoom }: Props) {
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
        <h1>
          {room.observing
            ? solo
              ? `${room.players[0]?.name ?? "Solo"} a terminé`
              : `${roundWinner?.name} gagne la manche`
            : solo
              ? "Bien joué !"
              : `${roundWinner?.name} gagne la manche`}
        </h1>
        <p>
          {room.observing ? (
            <span className="observe-badge">Observateur</span>
          ) : you ? (
            <>
              Cette manche : <b>{you.roundScore} pts</b> · Total : <b>{you.totalScore} pts</b>
            </>
          ) : null}
        </p>
        {room.you.earnedBadges.length > 0 && (
          <ul className="earned-badges">
            {room.you.earnedBadges.map((badge) => (
              <li key={badge.id} className="earned-badge" title={badge.description}>
                <span aria-hidden>{badge.icon}</span>
                <strong>{badge.title}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="results-layout">
        <div>
          <div className="results-board-row">
            {room.grid && <MiniGrid grid={room.grid} />}
            <div className="results-actions">
              {room.observing ? (
                <p className="hint">Tu observes la synthèse de cette manche.</p>
              ) : isHost ? (
                <button type="button" className="btn btn-gold" onClick={onNext}>
                  Manche suivante
                </button>
              ) : (
                <p className="hint">En attente de l’hôte pour la manche suivante…</p>
              )}
              <LeaveButton
                onLeave={onLeave}
                label="Quitter"
                title={room.observing ? "Arrêter d’observer ?" : "Quitter la partie ?"}
                message={
                  room.observing
                    ? "Tu ne verras plus la synthèse. La partie continue pour les joueurs."
                    : "Tu quittes la table. Les autres peuvent enchaîner sans toi."
                }
                confirmLabel={room.observing ? "Arrêter" : "Quitter"}
              />
              {admin && onCloseRoom && (
                <LeaveButton
                  onLeave={onCloseRoom}
                  label="Fermer le salon"
                  title="Fermer le salon ?"
                  message="La partie s’arrête tout de suite, pour toi et pour les autres joueurs."
                  confirmLabel="Fermer"
                />
              )}
            </div>
          </div>
          <div className="podium" style={{ marginTop: 16 }}>
            {ranked.map((p, i) => (
              <div
                className={`podium-item ${p.id === you?.id ? "you" : ""} ${p.connected ? "" : "offline"}`}
                key={p.id}
              >
                <div className="rank">{i + 1}</div>
                <div className="avatar" style={{ background: p.color }}>
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>
                    {p.name}
                    {p.id === you?.id ? " (toi)" : ""}
                    {!p.connected ? " · déconnecté" : ""}
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
          {!solo && <RoundChat room={room} />}
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
                  <div className="recap-table-wrap">
                    <table className="recap-table">
                      <tbody>
                        {summary.unique.map((w) => (
                          <UniqueWordRow
                            key={w.key}
                            word={w}
                            youId={room.you.id}
                            canLike={!solo && !room.observing}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {summary.shared.length > 0 && (
                <>
                  <h3 className="recap-title">Mots en commun (0 pt)</h3>
                  <div className="recap-table-wrap">
                    <table className="recap-table">
                      <tbody>
                        {summary.shared.map((w) => (
                          <SharedWordRow
                            key={w.key}
                            word={w}
                            youId={room.you.id}
                            canLike={!solo && !room.observing}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {rejected.length > 0 && (
                <>
                  <h3 className="recap-title">Pas dans le dico (à vérifier)</h3>
                  <div className="recap-table-wrap">
                    <table className="recap-table">
                      <tbody>
                        {rejected.map((w) => (
                          <tr key={w.key}>
                            <td>
                              <WordLink word={w.display} />
                            </td>
                            <td className="recap-who">
                              {w.names.map((player, index) => (
                                <span key={`${player.name}-${index}`} style={{ color: player.color }}>
                                  {index > 0 ? ", " : ""}
                                  {player.name}
                                </span>
                              ))}
                            </td>
                            <td className="recap-action">
                              {w.added ? (
                                <em className="added">ajouté</em>
                              ) : admin ? (
                                <button
                                  type="button"
                                  className="chip on add-word"
                                  onClick={() => socket.emit("dict:add", { key: w.key })}
                                >
                                  Ajouter
                                </button>
                              ) : null}
                            </td>
                            <td className="recap-pts">
                              {wordPoints(w.letters, w.names.length > 1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {summary && <PossibleWords summary={summary} />}
        </div>
      </div>
    </div>
  );
}

function UniqueWordRow({
  word,
  youId,
  canLike,
}: {
  word: SummaryWord;
  youId: string;
  canLike: boolean;
}) {
  const likedBy = word.likedBy ?? [];
  const mine = word.playerId === youId;

  return (
    <tr>
      <td>
        <WordLink word={word.display} />
      </td>
      <td className="recap-who" style={{ color: word.color }}>
        {word.name}
      </td>
      <td className="recap-action">
        <WordLikeControl
          wordKey={word.key}
          display={word.display}
          likedBy={likedBy}
          youId={youId}
          canLike={canLike && !mine}
          showCount={!canLike || mine}
        />
      </td>
      <td className="recap-pts">{word.points}</td>
    </tr>
  );
}

function SharedWordRow({
  word,
  youId,
  canLike,
}: {
  word: SharedWord;
  youId: string;
  canLike: boolean;
}) {
  const likedBy = word.likedBy ?? [];
  const foundIt = (word.playerIds ?? []).includes(youId);

  return (
    <tr>
      <td>
        <WordLink word={word.display} />
      </td>
      <td className="recap-who">
        {word.names.map((player, index) => (
          <span key={`${player.name}-${index}`} style={{ color: player.color }}>
            {index > 0 ? ", " : ""}
            {player.name}
          </span>
        ))}
      </td>
      <td className="recap-action">
        <WordLikeControl
          wordKey={word.key}
          display={word.display}
          likedBy={likedBy}
          youId={youId}
          canLike={canLike && !foundIt}
          showCount={foundIt}
        />
      </td>
      <td className="recap-pts">0</td>
    </tr>
  );
}

function WordLikeControl({
  wordKey,
  display,
  likedBy,
  youId,
  canLike,
  showCount,
}: {
  wordKey: string;
  display: string;
  likedBy: WordLike[];
  youId: string;
  canLike: boolean;
  showCount: boolean;
}) {
  const youLiked = likedBy.some((like) => like.playerId === youId);
  const names = likedBy.map((like) => (like.playerId === youId ? "toi" : like.name)).join(", ");

  if (canLike) {
    return (
      <button
        type="button"
        className={`word-like ${youLiked ? "on" : ""}`}
        aria-pressed={youLiked}
        aria-label={youLiked ? `Retirer le like de ${display}` : `Liker ${display}`}
        title={names ? `Aimé par ${names}` : "Liker ce mot"}
        onClick={() => socket.emit("chat:like", { key: wordKey })}
      >
        ♥{likedBy.length > 0 ? ` ${likedBy.length}` : ""}
      </button>
    );
  }
  if (showCount && likedBy.length > 0) {
    return (
      <span className="word-like-count" title={`Aimé par ${names}`}>
        ♥ {likedBy.length}
      </span>
    );
  }
  return null;
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

type ListedWord = PossibleWord & {
  owners: { name: string; color: string }[];
};

function listedPossibleWords(summary: RoundSummary): ListedWord[] {
  const byKey = new Map<string, ListedWord>();
  for (const w of summary.missed) {
    byKey.set(w.key, { ...w, owners: [] });
  }
  for (const w of summary.unique) {
    byKey.set(w.key, {
      key: w.key,
      display: w.display,
      letters: w.letters,
      points: w.points,
      owners: [{ name: w.name, color: w.color }],
    });
  }
  for (const w of summary.shared) {
    byKey.set(w.key, {
      key: w.key,
      display: w.display,
      letters: w.letters,
      points: 0,
      owners: w.names,
    });
  }
  return [...byKey.values()];
}

function PossibleWords({ summary }: { summary: RoundSummary }) {
  const words = listedPossibleWords(summary);
  const groups = new Map<number, ListedWord[]>();
  for (const word of words) {
    const list = groups.get(word.letters);
    if (list) list.push(word);
    else groups.set(word.letters, [word]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.display.localeCompare(b.display, "fr"));
  }
  const lengths = [...groups.keys()].sort((a, b) => b - a);
  const foundCount = summary.unique.length + summary.shared.length;
  const { possibleCount, missed } = summary;

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Mots possibles</h2>
      <p className="muted recap-help">
        {foundCount} trouvé{foundCount > 1 ? "s" : ""} sur {possibleCount}{" "}
        possible{possibleCount > 1 ? "s" : ""} dans la grille
        {missed.length > 0
          ? ` · ${missed.length} oublié${missed.length > 1 ? "s" : ""}`
          : ""}
        {foundCount > 0 ? ". Vert : un joueur. Rouge : plusieurs." : ""}
      </p>
      {words.length === 0 ? (
        <p className="muted">Aucun mot possible avec ces règles.</p>
      ) : (
        <>
          {missed.length === 0 && possibleCount > 0 && (
            <p>Tous les mots de la grille ont été trouvés. Bravo !</p>
          )}
          <div className="possible-tables">
            {lengths.map((n) => {
              const list = groups.get(n)!;
              const pts = wordPoints(n, false);
              return (
                <div key={n} className="possible-table">
                  <table>
                    <caption>
                      {n} lettre{n > 1 ? "s" : ""} ({pts} point{pts > 1 ? "s" : ""}) · {list.length}
                    </caption>
                    <tbody>
                      <tr>
                        {list.map((w) => {
                          const foundClass =
                            w.owners.length > 1
                              ? "found-shared"
                              : w.owners.length === 1
                                ? "found-unique"
                                : "";
                          const owners = w.owners.map((p) => p.name).join(", ");
                          return (
                            <td key={w.key} className={foundClass} title={owners || undefined}>
                              <WordLink word={w.display} />
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
