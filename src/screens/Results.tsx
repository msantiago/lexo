import { useState } from "react";
import { roundHeadline } from "@shared/round";
import type { Cell, RoomView } from "@shared/types";
import Avatar from "../components/Avatar";
import { BadgeButton } from "../components/BadgeDialog";
import InviteLink from "../components/InviteLink";
import WordTables, { PossibleWords } from "../components/WordTables";
import LeaveButton from "../components/LeaveButton";
import RoundChat from "../components/RoundChat";
import { primeSounds } from "../lib/sfx";
import { socket } from "../socket";

type Props = {
  room: RoomView;
  isHost: boolean;
  admin?: boolean;
  onNext: () => void;
  onRematch: () => void;
  onLeave: () => void;
};

export default function Results({ room, isHost, admin, onNext, onRematch, onLeave }: Props) {
  const [starting, setStarting] = useState(false);
  const ranked = [...room.players].sort(
    (a, b) => b.totalScore - a.totalScore || b.roundScore - a.roundScore,
  );
  const solo = room.players.length === 1;
  const you = room.players.find((p) => p.id === room.you.id);
  const summary = room.summary;
  const matchOver = room.matchOver;

  return (
    <div className="screen results">
      <div className="results-head">
        <p className="times-up-label">{matchOver ? "Partie terminée" : "Temps écoulé"}</p>
        <h1>
          {solo
            ? room.observing
              ? `${room.players[0]?.name ?? "Solo"} a terminé`
              : (you?.roundScore ?? 0) > 0
                ? "Bien joué !"
                : "Pas de mot cette fois"
            : roundHeadline(room.players)}
        </h1>
        <p>
          {room.observing ? (
            <span className="observe-badge">Observateur</span>
          ) : you ? (
            <>
              Cette manche : <b>{you.roundScore} pts</b> · Total : <b>{you.totalScore} pts</b>
              {!solo && room.settings.objective === "rounds" && (
                <>
                  {" "}
                  · Manche {room.round}/{room.settings.maxRounds}
                </>
              )}
              {!solo && room.settings.objective === "score" && (
                <>
                  {" "}
                  · Objectif {room.settings.targetScore} pts
                </>
              )}
            </>
          ) : null}
        </p>
        {room.you.earnedBadges.length > 0 && (
          <ul className="earned-badges">
            {room.you.earnedBadges.map((badge) => (
              <li key={badge.id}>
                <BadgeButton badge={badge} className="earned-badge">
                  <span aria-hidden>{badge.icon}</span>
                  <strong>{badge.title}</strong>
                </BadgeButton>
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
                <p className="hint">
                  {matchOver
                    ? "Tu observes la fin de cette partie."
                    : "Tu observes la synthèse de cette manche."}
                </p>
              ) : isHost ? (
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={starting}
                  onClick={() => {
                    if (starting) return;
                    setStarting(true);
                    void primeSounds().then(() => (matchOver ? onRematch() : onNext()));
                  }}
                >
                  {matchOver ? "Nouvelle partie" : "Manche suivante"}
                </button>
              ) : (
                <p className="hint">
                  {matchOver
                    ? "En attente de l’hôte pour une nouvelle partie…"
                    : "En attente de l’hôte pour la manche suivante…"}
                </p>
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
            </div>
          </div>
          <div className="podium">
            {ranked.map((p, i) => (
              <div
                className={`podium-item ${p.id === you?.id ? "you" : ""} ${p.connected ? "" : "offline"}`}
                key={p.id}
              >
                <div className="rank">{i + 1}</div>
                <Avatar name={p.name} image={p.image} color={p.color} />
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
                <div className="podium-pts">{p.totalScore}</div>
              </div>
            ))}
          </div>
          {!solo && !room.observing && room.settings.allowJoinMidGame && !matchOver && (
            <InviteLink code={room.code} label="Invite d’autres joueurs pour la prochaine manche" />
          )}
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
