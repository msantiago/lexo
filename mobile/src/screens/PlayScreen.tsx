import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { pathToWord } from "@shared/dice";
import { COUNTDOWN_STEPS, countdownIndex } from "@shared/countdown";
import type { RoomView, WordSubmitResult } from "@shared/types";
import Board from "../components/Board";
import TimerBar from "../components/TimerBar";
import { FAIL_MESSAGES } from "../lib/format";
import { getSocket } from "../socket";
import { colors } from "../theme";

type Props = {
  room: RoomView;
  onLeave: () => void;
};

export default function PlayScreen({ room, onLeave }: Props) {
  const observing = room.observing;
  const [path, setPath] = useState<number[]>([]);
  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [locked, setLocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lockedRef = useRef(locked);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPath([]);
    setFlash(null);
    setLocked(false);
    setFeedback(null);
  }, [room.startedAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (observing) return;
    getSocket().emit("game:trace", { cells: path });
  }, [observing, path]);

  const clearPath = () => {
    setPath([]);
    setLocked(false);
  };

  const flashBriefly = (kind: "success" | "fail") => {
    if (rejectTimer.current) clearTimeout(rejectTimer.current);
    setFlash(null);
    setTimeout(() => setFlash(kind), 0);
    rejectTimer.current = setTimeout(() => {
      setFlash((current) => (current === kind ? null : current));
    }, 420);
  };

  const showReject = (text: string) => {
    setFeedback({ text, ok: false });
    flashBriefly("fail");
    clearPath();
  };

  useEffect(() => {
    const socket = getSocket();
    const onResult = (result: WordSubmitResult) => {
      if (result.ok) {
        const text = result.shared
          ? "Déjà pris !"
          : result.word.points > 0
            ? `+${result.word.points} pts`
            : "Validé !";
        setFeedback({ text, ok: !result.shared });
        flashBriefly("success");
        clearPath();
        return;
      }
      showReject(FAIL_MESSAGES[result.reason]);
    };
    const onShared = () => {
      setFeedback({ text: "Quelqu’un a trouvé le même mot", ok: false });
      flashBriefly("fail");
    };
    socket.on("word:result", onResult);
    socket.on("word:shared", onShared);
    return () => {
      socket.off("word:result", onResult);
      socket.off("word:shared", onShared);
    };
  }, []);

  const submit = (next: number[]) => {
    if (!room.grid || lockedRef.current || observing) return;
    if (next.length === 0) {
      setPath([]);
      return;
    }
    const built = pathToWord(room.grid, next);
    if (built.letters < room.settings.minLetters) {
      showReject(FAIL_MESSAGES["too-short"]);
      return;
    }
    setLocked(true);
    setPath(next);
    getSocket().emit("game:word", { cells: next });
  };

  const counting =
    room.startedAt != null && countdownIndex(room.startedAt, now) != null;
  const countdownStep =
    room.startedAt != null ? countdownIndex(room.startedAt, now) : null;
  const remaining = counting
    ? room.settings.durationSec * 1000
    : room.endsAt
      ? Math.max(0, room.endsAt - now)
      : 0;
  const timeUp = remaining <= 0;
  const frozen = locked || timeUp || counting || observing;
  lockedRef.current = frozen;

  const preview = room.grid && path.length ? pathToWord(room.grid, path).display : "";
  const you = room.players.find((p) => p.id === room.you.id);
  const words = room.you.words;

  if (!room.grid) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>Préparation de la grille…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.meta}>
            {room.solo || room.settings.objective !== "rounds"
              ? `Manche ${room.round}`
              : `Manche ${room.round}/${room.settings.maxRounds}`}
            {" · "}
            {room.code}
          </Text>
          <Text style={styles.scoreLine}>
            {you ? `${you.roundScore} pts cette manche · ${you.totalScore} total` : "—"}
            {room.players.length > 1
              ? ` · ${room.players.length} joueurs`
              : ""}
          </Text>
        </View>
        <Pressable onPress={onLeave} hitSlop={8}>
          <Text style={styles.leave}>Quitter</Text>
        </Pressable>
      </View>

      <TimerBar remainingMs={remaining} totalMs={room.settings.durationSec * 1000} />

      <View style={styles.previewRow}>
        <Text style={styles.preview}>{preview || (observing ? "Observateur" : "Trace un mot")}</Text>
        {feedback ? (
          <Text style={[styles.feedback, feedback.ok ? styles.ok : styles.bad]}>
            {feedback.text}
          </Text>
        ) : null}
      </View>

      <View style={styles.boardSlot}>
        <Board
          grid={room.grid}
          path={path}
          flash={flash}
          disabled={frozen}
          onPathChange={setPath}
          onSubmit={submit}
        />
        {countdownStep != null ? (
          <View style={styles.countdown} pointerEvents="none">
            <Text style={styles.countdownText}>{COUNTDOWN_STEPS[countdownStep]}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.words}>
        <Text style={styles.wordsTitle}>
          Tes mots ({words.length})
          {you ? ` · ${you.roundScore} pts` : ""}
        </Text>
        <Text style={styles.wordsList}>
          {words.length === 0
            ? "Aucun pour l’instant"
            : words
                .map((w) => `${w.display}${w.shared ? "*" : ""} (${w.points})`)
                .join(" · ")}
        </Text>
      </View>

      {room.players.length > 1 ? (
        <View style={styles.others}>
          {room.players.map((p) => (
            <Text key={p.id} style={styles.otherLine}>
              <Text style={{ color: p.color }}>● </Text>
              {p.name}
              {p.id === room.you.id ? " (toi)" : ""}
              {" · "}
              {p.roundScore} pts · {p.wordCount} mot{p.wordCount > 1 ? "s" : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 12 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  scoreLine: { color: colors.cream, fontSize: 15, fontWeight: "600" },
  leave: { color: colors.goldSoft, fontWeight: "700", fontSize: 15, marginTop: 2 },
  previewRow: {
    minHeight: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  preview: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
    flexShrink: 1,
  },
  feedback: { fontSize: 15, fontWeight: "700" },
  ok: { color: "#6fdb9a" },
  bad: { color: colors.coral },
  boardSlot: { position: "relative" },
  countdown: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,36,33,0.45)",
    borderRadius: 20,
  },
  countdownText: {
    color: colors.cream,
    fontSize: 72,
    fontWeight: "900",
  },
  words: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  wordsTitle: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wordsList: { color: colors.cream, fontSize: 14, lineHeight: 20 },
  others: { gap: 4 },
  otherLine: { color: colors.textMuted, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 15 },
});
