import { useCallback, useEffect, useRef, useState } from "react";
import {
  extendTypedWord,
  findPathForWord,
  foldKey,
  pathToWord,
} from "@shared/dice";
import { countdownIndex, countdownRevealing, countdownShuffling } from "@shared/countdown";
import type { RoomView, WordSubmitResult } from "@shared/types";
import Board from "../components/Board";
import CountdownGate from "../components/CountdownGate";
import Scoreboard, { ScorePills } from "../components/Scoreboard";
import Timer from "../components/Timer";
import WordList from "../components/WordList";
import ScoreBursts, { createScoreBurst, type ScoreBurstItem } from "../components/ScoreBurst";
import LeaveButton from "../components/LeaveButton";
import { FAIL_MESSAGES } from "../lib/format";
import { loadShowOtherScores, saveShowOtherScores } from "../lib/prefs";
import {
  hapticFail,
  hapticSuccess,
  playFailSound,
  playLetterBack,
  playLetterSelect,
  playScoreSound,
  playStolenSound,
  unlockAudio,
} from "../lib/sfx";
import { socket } from "../socket";

type Props = {
  room: RoomView;
  admin?: boolean;
  onLeave: () => void;
  onCloseRoom?: () => void;
};

export default function Play({ room, admin, onLeave, onCloseRoom }: Props) {
  const observing = room.observing;
  const [drawPath, setDrawPath] = useState<number[]>([]);
  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean; id: number } | null>(
    null,
  );
  const [locked, setLocked] = useState(false);
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(Date.now());
  const [bursts, setBursts] = useState<ScoreBurstItem[]>([]);
  const [showOtherScores, setShowOtherScores] = useState(loadShowOtherScores);
  const [watchingId, setWatchingId] = useState<string | null>(
    room.players.find((p) => p.connected)?.id ?? room.players[0]?.id ?? null,
  );
  const [watchPinned, setWatchPinned] = useState(false);
  const [livePaths, setLivePaths] = useState<Record<string, number[]>>({});
  const showOtherScoresRef = useRef(showOtherScores);
  const watchPinnedRef = useRef(watchPinned);
  showOtherScoresRef.current = showOtherScores;
  watchPinnedRef.current = watchPinned;
  const removeBurst = useCallback((id: number) => {
    setBursts((list) => list.filter((item) => item.id !== id));
  }, []);
  const toggleOtherScores = useCallback(() => {
    setShowOtherScores((prev) => {
      const next = !prev;
      saveShowOtherScores(next);
      return next;
    });
  }, []);

  const watched =
    room.players.find((p) => p.id === watchingId) ?? room.players[0] ?? null;
  const typedPath =
    typed && room.grid ? findPathForWord(room.grid, typed) : null;
  const path = observing
    ? livePaths[watched?.id ?? ""] ?? watched?.path ?? []
    : typedPath?.length
      ? typedPath
      : drawPath;

  const pathRef = useRef(path);
  const typedRef = useRef(typed);
  const lockedRef = useRef(locked);
  const rejectTimer = useRef(0);
  pathRef.current = path;
  typedRef.current = typed;

  useEffect(() => {
    setDrawPath([]);
    setTyped("");
    setFlash(null);
    setLocked(false);
    setFeedback(null);
    setBursts([]);
    setLivePaths({});
    setWatchPinned(false);
    setWatchingId(room.players.find((p) => p.connected)?.id ?? room.players[0]?.id ?? null);
  }, [room.startedAt]);

  useEffect(() => {
    if (!observing) return;
    const onTrace = ({ playerId, cells }: { playerId: string; cells: number[] }) => {
      setLivePaths((prev) => ({ ...prev, [playerId]: cells }));
      if (!watchPinnedRef.current && cells.length > 0) setWatchingId(playerId);
    };
    socket.on("player:trace", onTrace);
    return () => {
      socket.off("player:trace", onTrace);
    };
  }, [observing]);

  useEffect(() => {
    if (observing) return;
    socket.emit("game:trace", { cells: path });
  }, [observing, path]);

  const watchedWordCount = watched?.words?.length ?? 0;
  const prevWatchedCount = useRef(watchedWordCount);
  useEffect(() => {
    if (!observing) {
      prevWatchedCount.current = watchedWordCount;
      return;
    }
    if (watchedWordCount > prevWatchedCount.current) {
      setFlash("success");
      window.setTimeout(() => setFlash(null), 420);
    }
    prevWatchedCount.current = watchedWordCount;
  }, [observing, watchedWordCount]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const clearWord = () => {
    window.clearTimeout(rejectTimer.current);
    setFlash(null);
    setDrawPath([]);
    setTyped("");
    setLocked(false);
  };

  const showReject = (text: string, clearPath: boolean) => {
    window.clearTimeout(rejectTimer.current);
    setFeedback({ text, ok: false, id: Date.now() });
    setFlash(null);
    window.setTimeout(() => setFlash("fail"), 0);
    playFailSound();
    hapticFail();
    if (clearPath) setLocked(true);
    rejectTimer.current = window.setTimeout(() => {
      setFlash((current) => (current === "fail" ? null : current));
      if (!clearPath) return;
      setDrawPath([]);
      setTyped("");
      setLocked(false);
    }, 680);
  };

  useEffect(() => {
    const onResult = (result: WordSubmitResult) => {
      if (result.ok) {
        setFlash("success");
        const text = result.shared
          ? "Déjà pris !"
          : result.word.points > 0
            ? `+${result.word.points} pts`
            : "Validé !";
        setFeedback({ text, ok: !result.shared, id: Date.now() });
        if (!result.shared && result.word.points > 0) {
          const burst = createScoreBurst(result.word.points, result.word.letters);
          setBursts((list) => [...list.slice(-6), burst]);
          playScoreSound(result.word.letters);
        } else if (result.shared && !showOtherScoresRef.current) {
          playStolenSound();
        }
        hapticSuccess(result.shared);
      } else {
        showReject(FAIL_MESSAGES[result.reason], true);
        return;
      }
      window.setTimeout(clearWord, 420);
    };
    socket.on("word:result", onResult);
    const onShared = () => {
      if (showOtherScoresRef.current) playStolenSound();
    };
    socket.on("word:shared", onShared);
    return () => {
      socket.off("word:result", onResult);
      socket.off("word:shared", onShared);
    };
  }, []);

  const submit = (next: number[]) => {
    unlockAudio();
    if (!room.grid || lockedRef.current) return;
    if (next.length === 0) {
      setDrawPath([]);
      setTyped("");
      return;
    }
    const built = pathToWord(room.grid, next);
    if (built.letters < room.settings.minLetters) {
      showReject(FAIL_MESSAGES["too-short"], true);
      return;
    }
    setLocked(true);
    setDrawPath(next);
    socket.emit("game:word", { cells: next });
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const grid = room.grid;
    if (!grid) return;

    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[data-confirm-dialog]")) return;
      unlockAudio();
      if (lockedRef.current || observing) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setDrawPath([]);
        setTyped("");
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        const current = pathRef.current;
        if (!current.length) return;
        const next = current.slice(0, -1);
        setDrawPath(next);
        setTyped(next.length ? pathToWord(grid, next).key : "");
        playLetterBack();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        submitRef.current(pathRef.current);
        return;
      }

      const letter = foldKey(e.key);
      if (!letter) return;
      e.preventDefault();
      const base =
        typedRef.current ||
        (pathRef.current.length && grid ? pathToWord(grid, pathRef.current).key : "");
      let nextTyped = extendTypedWord(grid, base, letter);
      if (nextTyped === null && base) {
        nextTyped = extendTypedWord(grid, "", letter);
      }
      if (nextTyped === null) {
        showReject("Pas sur la grille", false);
        return;
      }
      if (nextTyped === typedRef.current && pathRef.current.length) return;
      setTyped(nextTyped);
      const nextPath = findPathForWord(grid, nextTyped);
      playLetterSelect(nextPath?.length || nextTyped.length);
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [room.grid, room.startedAt, observing]);

  const counting = room.startedAt != null && countdownIndex(room.startedAt, now) != null;
  const remaining = counting
    ? room.settings.durationSec * 1000
    : room.endsAt
      ? Math.max(0, room.endsAt - now)
      : 0;
  const timeUp = remaining <= 0;
  const frozen = locked || timeUp || counting;
  lockedRef.current = frozen;
  const preview =
    room.grid && path.length ? pathToWord(room.grid, path).display : "";

  return (
    <div className="screen play">
      <div className="play-top">
        <div className="play-top-meta">
          <div className="muted">Manche {room.round}</div>
          <div className="muted">{room.code}</div>
          {observing && <div className="observe-badge">Observateur</div>}
        </div>
        <Timer remainingMs={remaining} totalMs={room.settings.durationSec * 1000} />
        <div className="play-top-actions">
          {admin && onCloseRoom && (
            <LeaveButton
              onLeave={onCloseRoom}
              label="Fermer"
              title="Fermer cette partie ?"
              message="Elle s’arrête pour tous les joueurs, y compris ceux qui sont en train de jouer."
              confirmLabel="Fermer"
              compact
            />
          )}
          <LeaveButton
            onLeave={onLeave}
            label="Quitter"
            title={observing ? "Arrêter d’observer ?" : "Quitter la partie ?"}
            message={
              observing
                ? "Tu ne verras plus cette partie. Elle continue pour les joueurs."
                : room.players.some((player) => player.id !== room.you.id && player.connected)
                  ? "Tu sors de l’écran. Ta place reste ouverte jusqu’à la fin de la manche."
                  : "Tu quittes cette partie."
            }
            confirmLabel={observing ? "Arrêter" : "Quitter"}
            compact
          />
        </div>
      </div>

      <ScorePills
        players={room.players}
        youId={observing ? "" : room.you.id}
        showOtherScores={observing || showOtherScores}
        onToggleOtherScores={
          !observing && room.players.length > 1 ? toggleOtherScores : undefined
        }
      />
      <Scoreboard
        players={room.players}
        youId={observing ? "" : room.you.id}
        showOtherScores={observing || showOtherScores}
        onToggleOtherScores={
          !observing && room.players.length > 1 ? toggleOtherScores : undefined
        }
      />

      <div className="stage">
        {observing && room.players.length > 0 && (
          <div className="observe-players" role="tablist" aria-label="Joueur observé">
            {room.players.map((player) => (
              <button
                key={player.id}
                type="button"
                role="tab"
                aria-selected={watched?.id === player.id}
                className={`observe-player${watched?.id === player.id ? " active" : ""}${
                  player.connected ? "" : " offline"
                }`}
                style={{ ["--player-color" as string]: player.color }}
                onClick={() => {
                  setWatchingId(player.id);
                  setWatchPinned(true);
                }}
              >
                {player.name}
              </button>
            ))}
          </div>
        )}
        <div className={`preview ${preview ? "" : "empty"}`}>
          {preview
            ? preview.split("").map((ch, i) => (
                <span className="pop" key={`${preview}-${i}`}>
                  {ch}
                </span>
              ))
            : observing
              ? watched
                ? `${watched.name} forme un mot…`
                : "En attente des joueurs"
              : "Glisse ou tape un mot"}
        </div>
        <div key={feedback?.id} className={`feedback ${feedback?.ok ? "ok" : ""}`} aria-live="polite">
          {feedback?.text ?? ""}
        </div>
        {room.grid && (
          <div className="board-burst-host">
            <CountdownGate startedAt={room.startedAt} now={now}>
              <Board
                key={room.startedAt ?? room.round}
                grid={room.grid}
                path={path}
                flash={flash}
                disabled={observing || frozen}
                shuffling={room.startedAt != null && countdownShuffling(room.startedAt, now)}
                revealing={room.startedAt != null && countdownRevealing(room.startedAt, now)}
                accent={observing ? watched?.color : undefined}
                onPathChange={(p) => {
                  if (observing || lockedRef.current) return;
                  setTyped("");
                  setDrawPath(p);
                }}
                onSubmit={submit}
              />
            </CountdownGate>
            <ScoreBursts bursts={bursts} onDone={removeBurst} />
          </div>
        )}
        <p className="hint">
          {observing
            ? watchPinned
              ? `Tu suis ${watched?.name ?? "un joueur"} — clique un autre prénom pour changer`
              : "Les traces s’affichent en direct"
            : "Clavier · Entrée pour valider · Q = Qu"}
        </p>
      </div>

      <WordList
        words={observing ? watched?.words ?? [] : room.you.words}
        title={
          observing && watched
            ? `Mots de ${watched.name} · ${watched.words?.length ?? 0} · ${watched.words?.reduce((sum, w) => sum + w.points, 0) ?? 0} pts`
            : undefined
        }
        accent={observing ? watched?.color : undefined}
      />
      {timeUp && (
        <div className="times-up-overlay">
          <div>
            <p className="times-up-label">Temps écoulé</p>
            <h2>Manche terminée</h2>
            <p>Décompte des mots…</p>
            <div className="times-up-leave">
              <LeaveButton
                onLeave={onLeave}
                label="Quitter"
                title="Quitter la partie ?"
                message={
                  observing
                    ? "Tu ne verras plus cette partie. Elle continue pour les joueurs."
                    : "Tu quittes avant la synthèse des mots."
                }
                confirmLabel={observing ? "Arrêter" : "Quitter"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
