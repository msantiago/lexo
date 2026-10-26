import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { COUNTDOWN_STEPS, countdownIndex } from "@shared/countdown";
import type {
  DailyFoundWord,
  DailyOverview,
  DailyPlayState,
} from "@shared/daily";
import { pathToWord } from "@shared/dice";
import type { WordFailReason } from "@shared/types";
import { apiFetch } from "../api";
import Board from "../components/Board";
import TimerBar from "../components/TimerBar";
import { FAIL_MESSAGES, formatTime } from "../lib/format";
import { colors } from "../theme";

type Props = {
  onBack: () => void;
  onPlayingChange?: (playing: boolean) => void;
};

export default function DailyScreen({ onBack, onPlayingChange }: Props) {
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [play, setPlay] = useState<DailyPlayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/daily");
      if (!res.ok) throw new Error("Impossible de charger le Lexo du jour.");
      setOverview((await res.json()) as DailyOverview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    onPlayingChange?.(Boolean(play));
    return () => onPlayingChange?.(false);
  }, [play, onPlayingChange]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/daily/start", { method: "POST" });
      const data = (await res.json()) as {
        play?: DailyPlayState;
        done?: DailyOverview;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Impossible de lancer le Lexo du jour.");
        return;
      }
      if (data.done) {
        setOverview(data.done);
        setPlay(null);
        return;
      }
      if (data.play) setPlay(data.play);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    const res = await apiFetch("/api/daily/finish", { method: "POST" });
    if (!res.ok) return;
    setOverview((await res.json()) as DailyOverview);
    setPlay(null);
  };

  if (play) {
    return (
      <DailyPlay
        play={play}
        onPlay={setPlay}
        onFinish={() => void finish()}
        onLeave={() => setPlay(null)}
      />
    );
  }

  if (!overview && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Retour</Text>
      </Pressable>
      <Text style={styles.title}>Lexo du jour</Text>
      <Text style={styles.body}>
        Une grille moyenne, la même pour tout le monde. Trois minutes, une seule fois.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {overview ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Aujourd’hui · {overview.day}</Text>
            {overview.played ? (
              <Text style={styles.body}>
                Score : {overview.score ?? 0} pts · {overview.wordCount ?? 0} mot
                {(overview.wordCount ?? 0) > 1 ? "s" : ""}
              </Text>
            ) : overview.inProgress ? (
              <Text style={styles.body}>Partie en cours — reprends où tu en étais.</Text>
            ) : (
              <Text style={styles.body}>Pas encore joué.</Text>
            )}
            {!overview.played || overview.inProgress ? (
              <Pressable
                style={[styles.btn, styles.btnGold, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void start()}
              >
                <Text style={styles.btnGoldText}>
                  {overview.inProgress ? "Reprendre" : "Jouer"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Classement</Text>
            {overview.leaderboard.length === 0 ? (
              <Text style={styles.hint}>Personne n’a encore joué.</Text>
            ) : (
              overview.leaderboard.slice(0, 15).map((row) => (
                <View key={row.userId} style={[styles.row, row.you && styles.you]}>
                  <Text style={styles.rank}>{row.rank}</Text>
                  <Text style={styles.name}>
                    {row.name}
                    {row.you ? " (toi)" : ""}
                  </Text>
                  <Text style={styles.pts}>{Math.round(row.rating)}</Text>
                </View>
              ))
            )}
          </View>

          {overview.words.length > 0 ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Tes mots</Text>
              <Text style={styles.words}>
                {overview.words.map((w) => `${w.display} (${w.points})`).join(" · ")}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function DailyPlay({
  play,
  onPlay,
  onFinish,
  onLeave,
}: {
  play: DailyPlayState;
  onPlay: (next: DailyPlayState) => void;
  onFinish: () => void;
  onLeave: () => void;
}) {
  const [path, setPath] = useState<number[]>([]);
  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [locked, setLocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lockedRef = useRef(locked);
  const playRef = useRef(play);
  playRef.current = play;
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (now >= play.endsAt) onFinish();
  }, [now, play.endsAt, onFinish]);

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

  const submit = async (cells: number[]) => {
    const current = playRef.current;
    if (lockedRef.current || cells.length === 0 || Date.now() >= current.endsAt) return;
    const built = pathToWord(current.grid, cells);
    if (built.letters < 4) {
      showReject(FAIL_MESSAGES["too-short"]);
      return;
    }
    setLocked(true);
    setPath(cells);
    const res = await apiFetch("/api/daily/word", {
      method: "POST",
      body: JSON.stringify({ cells }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      reason?: WordFailReason;
      words?: DailyFoundWord[];
      score?: number;
      finished?: boolean;
    };
    if (data.finished) {
      onFinish();
      return;
    }
    if (!data.ok || !data.words) {
      showReject(FAIL_MESSAGES[data.reason ?? "unknown"]);
      return;
    }
    const found = data.words[data.words.length - 1];
    onPlay({ ...current, words: data.words, score: data.score ?? current.score });
    setFeedback({ text: found ? `+${found.points} · ${found.display}` : "Validé", ok: true });
    flashBriefly("success");
    clearPath();
  };

  const counting = countdownIndex(play.endsAt - 180_000, now) != null;
  // Daily has no separate startedAt; treat as already started once play exists.
  const remaining = Math.max(0, play.endsAt - now);
  const frozen = locked || remaining <= 0;
  lockedRef.current = frozen;
  const preview = path.length ? pathToWord(play.grid, path).display : "";
  const countdownStep = null as number | null;

  return (
    <View style={styles.playWrap}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meta}>Lexo du jour · {formatTime(remaining)}</Text>
          <Text style={styles.scoreLine}>{play.score} pts</Text>
        </View>
        <Pressable onPress={onLeave}>
          <Text style={styles.leave}>Quitter</Text>
        </Pressable>
      </View>
      <TimerBar remainingMs={remaining} totalMs={180_000} />
      <View style={styles.previewRow}>
        <Text style={styles.preview}>{preview || "Trace un mot"}</Text>
        {feedback ? (
          <Text style={[styles.feedback, feedback.ok ? styles.ok : styles.bad]}>{feedback.text}</Text>
        ) : null}
      </View>
      <View style={styles.boardSlot}>
        <Board
          grid={play.grid}
          path={path}
          flash={flash}
          disabled={frozen || counting}
          onPathChange={setPath}
          onSubmit={(cells) => void submit(cells)}
        />
        {countdownStep != null ? (
          <View style={styles.countdown} pointerEvents="none">
            <Text style={styles.countdownText}>{COUNTDOWN_STEPS[countdownStep]}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Tes mots ({play.words.length})</Text>
        <Text style={styles.words}>
          {play.words.length === 0
            ? "Aucun pour l’instant"
            : play.words.map((w) => `${w.display} (${w.points})`).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  playWrap: { flex: 1, gap: 12 },
  center: { alignItems: "center", paddingVertical: 40 },
  back: { color: colors.goldSoft, fontWeight: "700", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "800", color: colors.cream },
  body: { color: colors.textSoft, fontSize: 15, lineHeight: 22 },
  error: { color: colors.coral, fontSize: 14 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.goldSoft,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  you: { backgroundColor: "rgba(232,184,74,0.08)", borderRadius: 8, paddingHorizontal: 6 },
  rank: { width: 24, color: colors.textMuted, fontWeight: "700" },
  name: { flex: 1, color: colors.cream, fontWeight: "600" },
  pts: { color: colors.gold, fontWeight: "800" },
  words: { color: colors.cream, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.textMuted, fontSize: 14 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnGold: { backgroundColor: colors.gold },
  btnGoldText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.55 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  scoreLine: { color: colors.cream, fontSize: 15, fontWeight: "600" },
  leave: { color: colors.goldSoft, fontWeight: "700", fontSize: 15 },
  previewRow: {
    minHeight: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  preview: { color: colors.gold, fontSize: 22, fontWeight: "800", letterSpacing: 2, flexShrink: 1 },
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
  countdownText: { color: colors.cream, fontSize: 72, fontWeight: "900" },
});
