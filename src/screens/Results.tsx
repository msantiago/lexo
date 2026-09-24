import type { Cell, RoomView } from "@shared/types";
import WordTables, { PossibleWords } from "../components/WordTables";
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
              <WordTables
                summary={summary}
                youId={room.you.id}
                canLike={!solo && !room.observing}
                admin={admin}
                onAddWord={(key) => socket.emit("dict:add", { key })}
              />
            </section>
          )}

          {summary && <PossibleWords summary={summary} />}
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
