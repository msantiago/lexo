import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameSettings, RoomView } from "@shared/types";
import Home from "./screens/Home";
import { Privacy, Terms } from "./screens/Legal";
import Lobby from "./screens/Lobby";
import Play from "./screens/Play";
import Results from "./screens/Results";
import { isLegalPath, isPrivacyPath, isTermsPath } from "./lib/nav";
import { socket } from "./socket";
import { installAudioUnlock } from "./lib/sfx";

const SESSION_KEY = "lexo:session";

type Session = { playerId: string; code: string };

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function sameSession(a: Session | null, b: Session | null) {
  return Boolean(a && b && a.code === b.code && a.playerId === b.playerId);
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [name, setName] = useState(() => localStorage.getItem("lexo:name") ?? "");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => loadSession()?.playerId ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const roomRef = useRef<RoomView | null>(null);
  const pendingRejoin = useRef<Session | null>(null);
  const toastTimer = useRef<number | null>(null);
  roomRef.current = room;

  const showToast = (message: string, ms = 2800) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };

  const clearLocalSession = () => {
    pendingRejoin.current = null;
    sessionStorage.removeItem(SESSION_KEY);
    setPlayerId(null);
  };

  const goHome = (message?: string) => {
    clearLocalSession();
    setRoom(null);
    socket.emit("lobby:list");
    if (message) showToast(message, 3500);
  };

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    localStorage.setItem("lexo:name", name);
  }, [name]);

  useEffect(() => {
    const onState = (next: RoomView) => {
      if (isLegalPath(window.location.pathname)) return;
      setRoom(next);
    };
    const onSession = (session: Session) => {
      pendingRejoin.current = null;
      setPlayerId(session.playerId);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    };
    const onError = ({ message }: { message: string }) => {
      if (message === "Salon introuvable" || message === "Joueur introuvable") {
        const attempted = pendingRejoin.current;
        pendingRejoin.current = null;
        if (roomRef.current) return;
        if (sameSession(attempted, loadSession())) {
          sessionStorage.removeItem(SESSION_KEY);
          setRoom(null);
          setPlayerId(null);
        }
        return;
      }
      showToast(message);
    };
    const onReplaced = () => {
      goHome("Ce compte joue sur un autre appareil");
    };
    const onClosed = () => {
      goHome("Ce salon a été fermé");
    };
    const onRole = ({ admin: next }: { admin: boolean }) => setAdmin(Boolean(next));
    const tryRejoin = () => {
      if (isLegalPath(window.location.pathname)) return;
      const existing = loadSession();
      pendingRejoin.current = existing;
      if (existing) socket.emit("room:rejoin", existing);
    };

    socket.on("room:state", onState);
    socket.on("session", onSession);
    socket.on("session:replaced", onReplaced);
    socket.on("session:role", onRole);
    socket.on("room:closed", onClosed);
    socket.on("notice", onError);
    socket.on("connect", tryRejoin);
    if (socket.connected) tryRejoin();
    const stopUnlock = installAudioUnlock();

    return () => {
      socket.off("room:state", onState);
      socket.off("session", onSession);
      socket.off("session:replaced", onReplaced);
      socket.off("session:role", onRole);
      socket.off("room:closed", onClosed);
      socket.off("notice", onError);
      socket.off("connect", tryRejoin);
      stopUnlock();
    };
  }, []);

  const leave = () => {
    const current = roomRef.current;
    const othersOnline = Boolean(
      current?.players.some((player) => player.id !== playerId && player.connected),
    );
    const keepSeat = Boolean(
      current && (current.phase === "playing" || current.phase === "results") && othersOnline,
    );
    socket.emit("room:leave");
    if (!keepSeat) clearLocalSession();
    setRoom(null);
    socket.emit("lobby:list");
  };

  const closeRoom = (code: string) => {
    socket.emit("room:close", { code });
  };

  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const legal = isLegalPath(path);

  return (
    <div className="app">
      <div className="grain" />
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {isPrivacyPath(path) && <Privacy />}
      {isTermsPath(path) && <Terms />}
      {!legal && !room && (
        <Home
          name={name}
          admin={admin}
          onName={setName}
          onSolo={() => socket.emit("room:create", { name, solo: true })}
          onCreate={() => socket.emit("room:create", { name, solo: false })}
          onJoin={(code) => socket.emit("room:join", { code, name })}
          onCloseRoom={closeRoom}
        />
      )}
      {!legal && room?.phase === "lobby" && (
        <Lobby
          room={room}
          isHost={isHost}
          admin={admin}
          onSettings={(settings: GameSettings) => socket.emit("room:settings", settings)}
          onStart={() => socket.emit("game:start")}
          onLeave={leave}
          onCloseRoom={() => closeRoom(room.code)}
        />
      )}
      {!legal && room?.phase === "playing" && (
        <Play room={room} admin={admin} onLeave={leave} onCloseRoom={() => closeRoom(room.code)} />
      )}
      {!legal && room?.phase === "results" && (
        <Results
          room={room}
          isHost={isHost}
          admin={admin}
          onNext={() => socket.emit("game:start")}
          onLeave={leave}
          onCloseRoom={() => closeRoom(room.code)}
        />
      )}
    </div>
  );
}
