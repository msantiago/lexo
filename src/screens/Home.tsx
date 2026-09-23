import { useEffect, useRef, useState, type ReactNode } from "react";
import { MAX_PLAYERS, foldPlayerName, type LobbyPlayer, type LobbyRoom } from "@shared/types";
import { difficultyLabel } from "@shared/rules";
import AccountPanel from "../components/AccountPanel";
import Avatar from "../components/Avatar";
import LeaveButton from "../components/LeaveButton";
import { JoinButton, WatchButton } from "../components/RoundActions";
import FloatingLetters from "../components/FloatingLetters";
import LexoLogo from "../components/LexoLogo";
import { unlockAudio } from "../lib/sfx";
import { authClient, displayNameFromUser, refreshSocketAuth } from "../lib/auth-client";
import { socket } from "../socket";
import Profile from "./Profile";
import Users from "./Users";

type Props = {
  name: string;
  admin?: boolean;
  onName: (name: string) => void;
  onSolo: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onObserve?: (code: string) => void;
  onWatch?: (userId: string) => void;
  onCloseRoom?: (code: string) => void;
  info?: ReactNode;
  onExitInfo?: () => void;
};

export default function Home({
  name,
  admin,
  onName,
  onSolo,
  onCreate,
  onJoin,
  onObserve,
  onWatch,
  onCloseRoom,
  info,
  onExitInfo,
}: Props) {
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [page, setPage] = useState<"play" | "account" | "users">("play");
  const [usersListRequest, setUsersListRequest] = useState(0);
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const ready = signedIn && name.trim().length > 0;

  useEffect(() => {
    if (!session?.user) return;
    onName(displayNameFromUser(session.user.name, session.user.email));
  }, [session?.user?.id, session?.user?.name, session?.user?.email, onName]);

  useEffect(() => {
    const onRooms = (next: LobbyRoom[]) => setRooms(next);
    socket.on("lobby:rooms", onRooms);
    socket.emit("lobby:list");
    return () => {
      socket.off("lobby:rooms", onRooms);
    };
  }, []);

  const wide = Boolean(info) || page === "users" || (page === "account" && signedIn && !isPending);
  const openTab = (next: "play" | "account" | "users") => {
    if (info) onExitInfo?.();
    setPage(next);
  };

  const signOut = async () => {
    await authClient.signOut();
    refreshSocketAuth();
    setPage("play");
  };

  const showApp = signedIn && !isPending;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [dockStuck, setDockStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!showApp || !sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setDockStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showApp]);

  return (
    <div className={`screen home ${showApp && wide ? "home-profile" : ""}`}>
      <FloatingLetters />
      <header className="home-brand">
        <LexoLogo />
        <p>Les mots sont sur la table</p>
      </header>
      {showApp && (
        <>
          <div ref={sentinelRef} className="dock-sentinel" aria-hidden="true" />
          <nav className={`dock${dockStuck ? " is-stuck" : ""}`} aria-label="Navigation">
          <button type="button" className="dock-logo" onClick={() => openTab("play")} tabIndex={dockStuck ? 0 : -1}>
            <LexoLogo compact />
          </button>
          <div className="dock-tabs">
            <DockTab current={!info && page === "play"} onClick={() => openTab("play")} label="Jouer">
              <DiceIcon />
            </DockTab>
            <DockTab
              current={!info && page === "users"}
              onClick={() => {
                openTab("users");
                setUsersListRequest((request) => request + 1);
              }}
              label="Joueurs"
            >
              <PeopleIcon />
            </DockTab>
            <DockTab
              current={!info && page === "account"}
              onClick={() => openTab("account")}
              label="Compte"
            >
              <PersonIcon />
            </DockTab>
          </div>
        </nav>
        </>
      )}
      {info ? (
        info
      ) : !showApp ? (
        isPending ? (
          <p className="hint">Chargement…</p>
        ) : (
          <AccountPanel admin={admin} onDisplayName={onName} />
        )
      ) : page === "users" ? (
        <Users listRequest={usersListRequest} onWatch={onWatch} />
      ) : page === "account" ? (
        <Profile onDisplayName={onName} onSignOut={() => void signOut()} />
      ) : (
        <>
          <div className="play-launch">
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
            Tu joueras en tant que {name.trim() || "…"} · jusqu’à 10 joueurs · grille 4×4
          </p>
          <section className="lobby-list" aria-live="polite">
            <LobbyRoomGroup
              title="Parties en cours"
              empty="Aucune partie en cours. Lance-en une pour commencer."
              rooms={rooms}
              name={name}
              ready={ready}
              admin={admin}
              onJoin={onJoin}
              onObserve={onObserve}
              onCloseRoom={admin ? onCloseRoom : undefined}
            />
          </section>
        </>
      )}
    </div>
  );
}

function DockTab({
  current,
  onClick,
  label,
  children,
}: {
  current: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-current={current ? "page" : undefined} onClick={onClick}>
      {children}
      {label}
    </button>
  );
}

function LobbyRoomGroup({
  title,
  empty,
  rooms,
  name,
  ready,
  admin,
  onJoin,
  onObserve,
  onCloseRoom,
}: {
  title: string;
  empty: string;
  rooms: LobbyRoom[];
  name: string;
  ready: boolean;
  admin?: boolean;
  onJoin: (code: string) => void;
  onObserve?: (code: string) => void;
  onCloseRoom?: (code: string) => void;
}) {
  return (
    <div className="lobby-group">
      <h2>{title}</h2>
      {rooms.length === 0 ? (
        <p className="hint">{empty}</p>
      ) : (
        <ul className="live-games">
          {rooms.map((room) => {
            const folded = foldPlayerName(name);
            const mineOffline = room.players.some(
              (p) => foldPlayerName(p.name) === folded && !p.connected,
            );
            const nameTaken = room.players.some(
              (p) => foldPlayerName(p.name) === folded && p.connected,
            );
            const canRejoin = ready && mineOffline;
            return (
              <LobbyRoomCard
                key={room.code}
                room={room}
                nameTaken={nameTaken}
                canRejoin={canRejoin}
                canJoin={canRejoin || (ready && !room.solo && room.playerCount < MAX_PLAYERS && !nameTaken)}
                admin={admin}
                onJoin={() => {
                  unlockAudio();
                  onJoin(room.code);
                }}
                onObserve={
                  onObserve
                    ? () => {
                        unlockAudio();
                        onObserve(room.code);
                      }
                    : undefined
                }
                onClose={onCloseRoom ? () => onCloseRoom(room.code) : undefined}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LobbyRoomCard({
  room,
  nameTaken,
  canRejoin,
  canJoin,
  admin,
  onJoin,
  onObserve,
  onClose,
}: {
  room: LobbyRoom;
  nameTaken: boolean;
  canRejoin: boolean;
  canJoin: boolean;
  admin?: boolean;
  onJoin: () => void;
  onObserve?: () => void;
  onClose?: () => void;
}) {
  const started = room.phase !== "lobby";
  const playing = room.phase === "playing";
  const host = room.players.find((player) => player.isHost) ?? room.players[0];
  const ranked = rankPlayers(room.players, playing);
  const status = gameStatus(room.phase);
  const countLabel = room.playerCount === 1 ? "1 joueur" : `${room.playerCount} joueurs`;

  return (
    <li className="live-game">
      <div className="live-host">
        {host && (
          <Avatar
            name={host.name}
            image={host.image}
            color={host.image ? undefined : host.color}
            online={host.connected}
          />
        )}
        <div className="live-host-meta">
          <strong>{host?.name ?? (room.solo ? "Solo" : "Salon")}</strong>
          <span className="host-badge">Maître du jeu</span>
          <span className={`player-status ${status.kind}`}>{status.label}</span>
          <span className="live-sub">
            {room.solo ? "Solo" : "Collectif"}
            {" · "}
            {difficultyLabel(room.difficulty)}
            {" · "}
            {countLabel}
          </span>
        </div>
      </div>
      <ol className="live-scores">
        {ranked.map((player) => (
          <li key={player.id} className={player.isHost ? "is-host" : player.connected ? "" : "offline"}>
            <Avatar
              name={player.name}
              image={player.image}
              color={player.image ? undefined : player.color}
              online={player.connected}
            />
            <span className="live-seat-name">{player.name}</span>
            {started && <b>{player.totalScore + (playing ? player.roundScore : 0)}</b>}
          </li>
        ))}
      </ol>
      <RoomActions
        room={room}
        canJoin={canJoin}
        canRejoin={canRejoin}
        nameTaken={nameTaken}
        admin={admin}
        onJoin={onJoin}
        onObserve={onObserve}
        onClose={onClose}
      />
    </li>
  );
}

function rankPlayers(players: LobbyPlayer[], playing: boolean): LobbyPlayer[] {
  const points = (player: LobbyPlayer) => player.totalScore + (playing ? player.roundScore : 0);
  return [...players].sort(
    (a, b) => points(b) - points(a) || a.name.localeCompare(b.name, "fr"),
  );
}

function gameStatus(phase: LobbyRoom["phase"]): { label: string; kind: string } {
  if (phase === "playing") return { label: "En cours", kind: "started" };
  if (phase === "results") return { label: "Résultats", kind: "results" };
  return { label: "En attente", kind: "waiting" };
}

function RoomActions({
  room,
  canJoin,
  canRejoin,
  nameTaken,
  admin,
  onJoin,
  onObserve,
  onClose,
}: {
  room: LobbyRoom;
  canJoin: boolean;
  canRejoin: boolean;
  nameTaken: boolean;
  admin?: boolean;
  onJoin: () => void;
  onObserve?: () => void;
  onClose?: () => void;
}) {
  const full = room.playerCount >= MAX_PLAYERS;
  let joinLabel = "Rejoindre";
  if (canRejoin) joinLabel = "Revenir";
  else if (full) joinLabel = "Complet";
  else if (nameTaken) joinLabel = "Prénom pris";

  return (
    <div className="live-actions">
      {onObserve && <WatchButton onClick={onObserve} />}
      {!room.solo && <JoinButton label={joinLabel} disabled={!canJoin} onClick={onJoin} />}
      {admin && onClose && (
        <LeaveButton
          compact
          onLeave={onClose}
          label="Fermer"
          title="Fermer cette partie ?"
          message="Les joueurs sont renvoyés à l’accueil. Cette partie ne reprendra pas."
          confirmLabel="Fermer"
        />
      )}
    </div>
  );
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 18.5c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 15.2c1.5-.2 3 .6 3.8 2.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="9" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 18.5c.8-2.8 2.8-4.2 6-4.2s5.2 1.4 6 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
