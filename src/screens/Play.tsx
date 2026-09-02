import { useCallback, useEffect, useRef, useState } from "react";
import {
  extendTypedWord,
  findPathForWord,
  foldKey,
  pathToWord,
} from "@shared/dice";
import type { RoomView, WordSubmitResult } from "@shared/types";
import Board from "../components/Board";
import RerollBar from "../components/RerollBar";
import Scoreboard, { ScorePills } from "../components/Scoreboard";
import Timer from "../components/Timer";
import WordList from "../components/WordList";
import ScoreBursts, { createScoreBurst, type ScoreBurstItem } from "../components/ScoreBurst";
import LeaveButton from "../components/LeaveButton";
import { FAIL_MESSAGES } from "../lib/format";
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
  onLeave: () => void;
};

export default function Play({ room, onLeave }: Props) {
  const [drawPath, setDrawPath] = useState<number[]>([]);
  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean; id: number } | null>(
    null,
  );
  const [locked, setLocked] = useState(false);
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(Date.now());
  const [bursts, setBursts] = useState<ScoreBurstItem[]>([]);
  const removeBurst = useCallback((id: number) => {
    setBursts((list) => list.filter((item) => item.id !== id));
  }, []);

  const typedPath =
    typed && room.grid ? findPathForWord(room.grid, typed) : null;
  const path = typedPath?.length ? typedPath : drawPath;

  const pathRef = useRef(path);
  const typedRef = useRef(typed);
  const lockedRef = useRef(locked);
  pathRef.current = path;
  typedRef.current = typed;
  lockedRef.current = locked || (room.endsAt !== null && Date.now() >= room.endsAt);

  useEffect(() => {
    setDrawPath([]);
    setTyped("");
    setFlash(null);
    setLocked(false);
    setFeedback(null);
    setBursts([]);
  }, [room.startedAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const clearWord = () => {
    setFlash(null);
    setDrawPath([]);
    setTyped("");
    setLocked(false);
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
        }
        hapticSuccess(result.shared);
      } else {
        setFlash("fail");
        setFeedback({ text: FAIL_MESSAGES[result.reason], ok: false, id: Date.now() });
        playFailSound();
        hapticFail();
      }
      window.setTimeout(clearWord, 420);
    };
    socket.on("word:result", onResult);
    const onShared = () => {
      playStolenSound();
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
      setFlash("fail");
      setFeedback({ text: FAIL_MESSAGES["too-short"], ok: false, id: Date.now() });
      playFailSound();
      hapticFail();
      setLocked(true);
      window.setTimeout(clearWord, 420);
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
      unlockAudio();
      if (lockedRef.current) return;
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
        setFeedback({ text: "Pas sur la grille", ok: false, id: Date.now() });
        return;
      }
      if (nextTyped === typedRef.current && pathRef.current.length) return;
      setTyped(nextTyped);
      const nextPath = findPathForWord(grid, nextTyped);
      playLetterSelect(nextPath?.length || nextTyped.length);
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [room.grid, room.startedAt]);

  const remaining = room.endsAt ? Math.max(0, room.endsAt - now) : 0;
  const timeUp = remaining <= 0;
  const frozen = locked || timeUp;
  const preview =
    room.grid && path.length ? pathToWord(room.grid, path).display : "";

  return (
    <div className="screen play">
      <div className="play-top">
        <div className="play-top-meta">
          <div className="muted">Manche {room.round}</div>
          <div className="muted">{room.code}</div>
        </div>
        <Timer remainingMs={remaining} totalMs={room.settings.durationSec * 1000} />
        <div className="play-top-actions">
          <LeaveButton
            onLeave={onLeave}
            label="Quitter"
            confirmLabel="Confirmer ?"
            compact
          />
        </div>
      </div>

      <ScorePills players={room.players} youId={room.you.id} />
      <Scoreboard players={room.players} youId={room.you.id} />

      <div className="stage">
        <div className={`preview ${preview ? "" : "empty"}`}>
          {preview
            ? preview.split("").map((ch, i) => (
                <span className="pop" key={`${preview}-${i}`}>
                  {ch}
                </span>
              ))
            : "Glisse ou tape un mot"}
        </div>
        {room.grid && (
          <div className="board-burst-host">
            <Board
              key={room.startedAt ?? room.round}
              grid={room.grid}
              path={path}
              flash={flash}
              disabled={frozen}
              onPathChange={(p) => {
                if (lockedRef.current) return;
                setTyped("");
                setDrawPath(p);
              }}
              onSubmit={submit}
            />
            <ScoreBursts bursts={bursts} onDone={removeBurst} />
          </div>
        )}
        {room.reroll && !timeUp && (
          <RerollBar reroll={room.reroll} players={room.players} now={now} deal={room.startedAt} />
        )}
        <div key={feedback?.id} className={`feedback ${feedback?.ok ? "ok" : ""}`}>
          {feedback?.text ?? ""}
        </div>
        <p className="hint">Clavier · Entrée pour valider · Q = Qu</p>
      </div>

      <WordList words={room.you.words} />
      {timeUp && (
        <div className="times-up-overlay">
          <div>
            <p className="times-up-label">Temps écoulé</p>
            <h2>Manche terminée</h2>
            <p>Décompte des mots…</p>
            <div className="times-up-leave">
              <LeaveButton onLeave={onLeave} label="Quitter" confirmLabel="Confirmer ?" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
