import { useEffect, useState } from "react";
import { letterNeedsBaseMark } from "@shared/dice";
import { matchHeadline, roundHeadline } from "@shared/round";
import type { Cell, RoomView } from "@shared/types";
import Avatar from "../components/Avatar";
import { BadgeButton } from "../components/BadgeDialog";
import InviteLink from "../components/InviteLink";
import WordTables, { PossibleWords } from "../components/WordTables";
import LeaveButton from "../components/LeaveButton";
import RoundChat from "../components/RoundChat";
import { formatTime } from "../lib/format";
import { primeSounds } from "../lib/sfx";
import { socket } from "../socket";

type Props = {
  room: RoomView;
  isHost: boolean;
  admin?: boolean;
  onReady: () => void;
  onRematch: () => void;
  onLeave: () => void;
};

export default function Results({ room, isHost, admin, onReady, onRematch, onLeave }: Props) {
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ranked = [...room.players].sort(
    (a, b) => b.totalScore - a.totalScore || b.roundScore - a.roundScore,
  );
  const solo = room.players.length === 1;
  const you = room.players.find((p) => p.id === room.you.id);
  const summary = room.summary;
  const matchOver = room.matchOver;
  const readyIds = new Set(room.readyIds);
  const youReady = readyIds.has(room.you.id);
  const connected = room.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => readyIds.has(p.id)).length;
  const remainingMs =
    !matchOver && room.nextRoundAt != null ? Math.max(0, room.nextRoundAt - now) : 0;

  useEffect(() => {
    if (matchOver || room.nextRoundAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [matchOver, room.nextRoundAt]);

  useEffect(() => {
    setStarting(false);
  }, [room.round, room.phase, matchOver]);

  return (
    <div className={`screen results${matchOver ? " match-over" : ""}`}>
      <div className="results-head">
        <p className="times-up-label">{matchOver ? "Partie terminée" : "Temps écoulé"}</p>
        <h1>
          {solo
            ? room.observing
              ? `${room.players[0]?.name ?? "Solo"} a terminé`
              : matchOver
                ? room.endedByInactivity
                  ? "Partie arrêtée"
                  : "Partie terminée"
                : (you?.roundScore ?? 0) > 0
                  ? "Bien joué !"
                  : "Pas de mot cette fois"
            : matchOver
              ? room.endedByInactivity
                ? "Partie arrêtée"
                : matchHeadline(room.players)
              : roundHeadline(room.players)}
        </h1>
        {room.endedByInactivity && (
          <p className="hint">Aucune activité pendant la manche — la partie est stoppée.</p>
        )}
        <p>
          {room.observing ? (
            <span className="observe-badge">Observateur</span>
          ) : you ? (
            <>
              {matchOver ? (
                <>
                  Score final : <b>{you.totalScore} pts</b>
                </>
              ) : (
                <>
                  Cette manche : <b>{you.roundScore} pts</b> · Total : <b>{you.totalScore} pts</b>
                </>
              )}
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
              ) : matchOver ? (
                isHost ? (
                  <button
                    type="button"
                    className="btn btn-gold"
                    disabled={starting}
                    onClick={() => {
                      if (starting) return;
                      setStarting(true);
                      void primeSounds().then(onRematch);
                    }}
                  >
                    Nouvelle partie
                  </button>
                ) : (
                  <p className="hint">En attente de l’hôte pour une nouvelle partie…</p>
                )
              ) : (
                <>
                  <p className="next-round-timer" role="timer" aria-live="polite">
                    Manche suivante dans <b>{formatTime(remainingMs)}</b>
                  </p>
                  <button
                    type="button"
                    className={`btn ${youReady ? "btn-ghost" : "btn-gold"}`}
                    disabled={starting}
                    onClick={() => {
                      void primeSounds().then(onReady);
                    }}
                  >
                    {youReady ? "Annuler" : solo ? "Manche suivante" : "Je suis prêt"}
                  </button>
                  {!solo && (
                    <p className="hint ready-count">
                      {readyCount}/{connected.length} prêt
                      {readyCount > 1 ? "s" : ""}
                      {readyCount === connected.length && connected.length > 0
                        ? " — c’est parti !"
                        : ""}
                    </p>
                  )}
                </>
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
            <h2 className="podium-title">{matchOver ? "Palmarès" : "Classement"}</h2>
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
                    {!matchOver && readyIds.has(p.id) ? " · prêt" : ""}
                  </strong>
                  <div className="muted">
                    {matchOver ? (
                      <>
                        {p.totalScore} pt{p.totalScore > 1 ? "s" : ""}
                      </>
                    ) : (
                      <>
                        +{p.roundScore} cette manche · {p.wordCount} mot
                        {p.wordCount > 1 ? "s" : ""}
                      </>
                    )}
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
          <span
            className={`die-face${letterNeedsBaseMark(cell.display) ? " marked" : ""}`}
            style={{ transform: `rotate(${cell.rotation}deg)` }}
          >
            {cell.display}
          </span>
        </div>
      ))}
    </div>
  );
}
