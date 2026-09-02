import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameSettings, RoomView } from "@shared/types";
import Home from "./screens/Home";
import Lobby from "./screens/Lobby";
import Play from "./screens/Play";
import Results from "./screens/Results";
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

export default function App() {
  const [name, setName] = useState(() => localStorage.getItem("lexo:name") ?? "");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => loadSession()?.playerId ?? null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("lexo:name", name);
  }, [name]);

  useEffect(() => {
    const onState = (next: RoomView) => setRoom(next);
    const onSession = (session: Session) => {
      setPlayerId(session.playerId);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    };
    const onError = ({ message }: { message: string }) => {
      setToast(message);
      if (message === "Salon introuvable" || message === "Joueur introuvable") {
        sessionStorage.removeItem(SESSION_KEY);
        setRoom(null);
        setPlayerId(null);
      }
      window.setTimeout(() => setToast(null), 2800);
    };
    socket.on("room:state", onState);
    socket.on("session", onSession);
    socket.on("notice", onError);

    const existing = loadSession();
    if (existing) socket.emit("room:rejoin", existing);
    const stopUnlock = installAudioUnlock();

    return () => {
      socket.off("room:state", onState);
      socket.off("session", onSession);
      socket.off("notice", onError);
      stopUnlock();
    };
  }, []);

  const leave = () => {
    socket.emit("room:leave");
    sessionStorage.removeItem(SESSION_KEY);
    setRoom(null);
    setPlayerId(null);
    socket.disconnect();
    socket.connect();
  };

  const isHost = Boolean(room && playerId && room.hostId === playerId);

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

      {!room && (
        <Home
          name={name}
          onName={setName}
          onSolo={() => socket.emit("room:create", { name, solo: true })}
          onCreate={() => socket.emit("room:create", { name, solo: false })}
          onJoin={(code) => socket.emit("room:join", { code, name })}
        />
      )}
      {room?.phase === "lobby" && (
        <Lobby
          room={room}
          isHost={isHost}
          onSettings={(settings: GameSettings) => socket.emit("room:settings", settings)}
          onStart={() => socket.emit("game:start")}
          onLeave={leave}
        />
      )}
      {room?.phase === "playing" && <Play room={room} onLeave={leave} />}
      {room?.phase === "results" && (
        <Results
          room={room}
          isHost={isHost}
          onNext={() => socket.emit("game:start")}
          onLeave={leave}
        />
      )}
    </div>
  );
}
