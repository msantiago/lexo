import { useEffect, useState } from "react";
import { MAX_PLAYERS, foldPlayerName, type LobbyRoom } from "@shared/types";
import { difficultyLabel, phaseLabel } from "@shared/rules";
import AccountPanel from "../components/AccountPanel";
import FloatingLetters from "../components/FloatingLetters";
import LexoLogo from "../components/LexoLogo";
import { unlockAudio } from "../lib/sfx";
import { authClient } from "../lib/auth-client";
import { socket } from "../socket";
import Profile from "./Profile";

type Props = {
  name: string;
  onName: (name: string) => void;
  onSolo: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
};

export default function Home({ name, onName, onSolo, onCreate, onJoin }: Props) {
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [page, setPage] = useState<"play" | "profile">("play");
  const { data: session } = authClient.useSession();
  const ready = name.trim().length > 0;

  useEffect(() => {
    const onRooms = (next: LobbyRoom[]) => setRooms(next);
    socket.on("lobby:rooms", onRooms);
    socket.emit("lobby:list");
    return () => {
      socket.off("lobby:rooms", onRooms);
    };
  }, []);

  const showProfile = page === "profile" && Boolean(session?.user);

  return (
    <div className={`screen home ${showProfile ? "home-profile" : ""}`}>
      <FloatingLetters />
      {!showProfile && (
        <>
          <div className="logo">
            <LexoLogo />
            <p>Les mots sont sur la table</p>
          </div>
          <AccountPanel
            onDisplayName={onName}
            onOpenProfile={session?.user ? () => setPage("profile") : undefined}
          />
        </>
      )}
      {showProfile ? (
        <Profile onBack={() => setPage("play")} onDisplayName={onName} />
      ) : (
        <>
      <div className="panel">
        {!session?.user && (
          <div className="field">
            <label htmlFor="name">Ton prénom</label>
            <input
              id="name"
              maxLength={16}
              placeholder="Alex"
              value={name}
              onChange={(e) => onName(e.target.value)}
            />
          </div>
        )}
        <div className="btn-row">
          <button
            className="btn btn-gold"
            disabled={!ready}
            onClick={() => {
              unlockAudio();
              onSolo();
            }}
          >
            Partie solo
          </button>
          <button
            className="btn btn-ivory"
            disabled={!ready}
            onClick={() => {
              unlockAudio();
              onCreate();
            }}
          >
            Créer un salon
          </button>
        </div>
        <p className="hint">
          {session?.user
            ? `Tu joueras en tant que ${name.trim() || "…"} · jusqu’à 10 joueurs · grille 4×4`
            : "Jusqu’à 10 joueurs · grille 4×4 · chrono en direct"}
        </p>
      </div>

      <section className="lobby-list" aria-live="polite">
        <h2>Salons en cours</h2>
        {rooms.length === 0 ? (
          <p className="hint">Aucun salon pour le moment. Crée-en un pour commencer.</p>
        ) : (
          <ul className="lobby-rooms">
            {rooms.map((room) => {
              const nameTaken = room.players.some(
                (p) => foldPlayerName(p.name) === foldPlayerName(name),
              );
              return (
                <LobbyRoomCard
                  key={room.code}
                  room={room}
                  nameTaken={nameTaken}
                  canJoin={ready && room.playerCount < MAX_PLAYERS && !nameTaken}
                  onJoin={() => {
                    unlockAudio();
                    onJoin(room.code);
                  }}
                />
              );
            })}
          </ul>
        )}
      </section>
        </>
      )}
      <footer className="credits">
        <p>Créé par Marc-Antoine Santiago — septembre 2026</p>
        <nav className="legal-links">
          <a href="/privacy">Confidentialité</a>
          <a href="/terms">Conditions d’utilisation</a>
        </nav>
      </footer>
    </div>
  );
}

function LobbyRoomCard({
  room,
  nameTaken,
  canJoin,
  onJoin,
}: {
  room: LobbyRoom;
  nameTaken: boolean;
  canJoin: boolean;
  onJoin: () => void;
}) {
  const full = room.playerCount >= MAX_PLAYERS;
  const started = room.phase !== "lobby";
  const countLabel =
    room.playerCount === 1 ? "1 joueur" : `${room.playerCount} joueurs`;
  const playing = room.phase === "playing";
  const players = started
    ? [...room.players].sort(
        (a, b) =>
          b.totalScore + (playing ? b.roundScore : 0) -
            (a.totalScore + (playing ? a.roundScore : 0)) || a.name.localeCompare(b.name, "fr"),
      )
    : room.players;

  let joinLabel = "Rejoindre";
  if (full) joinLabel = "Complet";
  else if (nameTaken) joinLabel = "Prénom pris";

  return (
    <li className={`lobby-room ${started ? "started" : "waiting"}`}>
      <div className="lobby-room-head">
        <span className={`lobby-room-phase ${started ? "started" : "waiting"}`}>
          {phaseLabel(room.phase)}
        </span>
        <span className="lobby-room-count">{countLabel}</span>
      </div>
      {started && (
        <p className="lobby-room-difficulty">Difficulté : {difficultyLabel(room.difficulty)}</p>
      )}
      <ul className={`lobby-room-players ${started ? "scored" : ""}`}>
        {players.map((p) => (
          <li className="lobby-room-player" key={p.id}>
            <span className="avatar" style={{ background: p.color }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <strong>{p.name}</strong>
            {p.isHost && <span className="host-badge">Hôte</span>}
            {started && (
              <span className="lobby-room-scores">
                <span className="lobby-room-total">
                  {p.totalScore}
                  <small>total</small>
                </span>
                {playing && (
                  <span className="lobby-room-round">
                    {p.roundScore}
                    <small>manche</small>
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost" type="button" disabled={!canJoin} onClick={onJoin}>
        {joinLabel}
      </button>
    </li>
  );
}
