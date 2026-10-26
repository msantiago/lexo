import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { pathToWord } from "@shared/dice";
import { matchScore, rankLabel, standingRank } from "@shared/round";
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
  const focusId = observing
    ? (room.players.find((player) => player.connected)?.id ?? room.players[0]?.id ?? "")
    : room.you.id;
  const you = room.players.find((player) => player.id === focusId) ?? null;
  const others = room.players
    .filter((player) => player.id !== focusId)
    .sort(
      (a, b) =>
        matchScore(b.totalScore, b.roundScore, true) - matchScore(a.totalScore, a.roundScore, true) ||
        a.name.localeCompare(b.name, "fr"),
    );
  const rank = you && room.players.length > 1 ? standingRank(room.players, you.id) : 0;
  const place = rank === 1 || rank === 2 || rank === 3 ? rank : 0;
  const words = room.you.words;
  const self = room.players.find((player) => player.id === room.you.id) ?? null;

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
          {room.players.length > 1 ? (
            <Text style={styles.scoreMeta}>{room.players.length} joueurs</Text>
          ) : null}
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

      {others.length > 0 ? (
        <View style={styles.othersRow}>
          {others.map((player) => (
            <View key={player.id} style={styles.otherChip}>
              <View style={[styles.dot, { backgroundColor: player.color }]} />
              <Text style={styles.otherName} numberOfLines={1}>
                {player.name}
              </Text>
              <Text style={styles.otherScore}>{player.roundScore}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {you ? (
        <View style={styles.youScore}>
          <Text style={styles.youScoreValue}>{you.roundScore}</Text>
          {rank > 0 ? (
            <View style={styles.rank} accessibilityLabel={rankLabel(rank)}>
              {place > 0 ? <Medal place={place} /> : <Text style={styles.rankText}>{rankLabel(rank)}</Text>}
            </View>
          ) : null}
        </View>
      ) : null}

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
          {self ? ` · ${self.roundScore} pts` : ""}
        </Text>
        <Text style={styles.wordsList}>
          {words.length === 0
            ? "Aucun pour l’instant"
            : words
                .map((w) => `${w.display}${w.shared ? "*" : ""} (${w.points})`)
                .join(" · ")}
        </Text>
      </View>

    </View>
  );
}

const METAL = {
  1: { disc: "#f6c445", rim: "#e2a61a", ink: "#c4840a" },
  2: { disc: "#d5dde6", rim: "#b4bec8", ink: "#7b8794" },
  3: { disc: "#e2a86e", rim: "#c4844a", ink: "#8d5a32" },
} as const;

function Medal({ place }: { place: 1 | 2 | 3 }) {
  const metal = METAL[place];
  return (
    <Svg width={22} height={26} viewBox="0 0 48 58">
      <Path fill="#ef3d3d" d="M16 30 9 50l8-5 5 11 2-22z" />
      <Path fill="#d12525" d="M32 30 39 50l-8-5-5 11-2-22z" />
      <Circle cx={24} cy={20} r={16} fill={metal.disc} />
      <Circle cx={24} cy={20} r={12.4} fill="none" stroke={metal.rim} strokeWidth={1.6} />
      <SvgText
        x={24}
        y={22}
        textAnchor="middle"
        fontSize={16}
        fontWeight="700"
        fill={metal.ink}
      >
        {place}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 12 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  scoreMeta: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  othersRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  otherChip: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  otherName: { color: colors.textMuted, fontSize: 12, fontWeight: "700", maxWidth: 72 },
  otherScore: { color: colors.gold, fontSize: 14, fontWeight: "800" },
  youScore: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  youScoreValue: { color: colors.gold, fontSize: 28, fontWeight: "800" },
  rank: { marginTop: -2, marginLeft: 2 },
  rankText: { color: colors.goldSoft, fontSize: 13, fontWeight: "800" },
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
  hint: { color: colors.textMuted, fontSize: 15 },
});
