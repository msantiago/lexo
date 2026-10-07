import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { matchHeadline, roundHeadline } from "@shared/round";
import type { RoomView } from "@shared/types";
import { formatTime } from "../lib/format";
import { getSocket } from "../socket";
import { colors } from "../theme";

type Props = {
  room: RoomView;
  isHost: boolean;
  onLeave: () => void;
};

export default function ResultsScreen({ room, isHost, onLeave }: Props) {
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ranked = [...room.players].sort(
    (a, b) => b.totalScore - a.totalScore || b.roundScore - a.roundScore,
  );
  const solo = room.players.length === 1;
  const you = room.players.find((p) => p.id === room.you.id);
  const matchOver = room.matchOver;
  const readyIds = new Set(room.readyIds);
  const youReady = readyIds.has(room.you.id);
  const connected = room.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => readyIds.has(p.id)).length;
  const remainingMs =
    !matchOver && room.nextRoundAt != null ? Math.max(0, room.nextRoundAt - now) : 0;

  useEffect(() => {
    if (matchOver || room.nextRoundAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [matchOver, room.nextRoundAt]);

  useEffect(() => {
    setStarting(false);
  }, [room.round, room.phase, matchOver]);

  const title = solo
    ? matchOver
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
      : roundHeadline(room.players);

  const onReady = () => getSocket().emit("game:ready");
  const onRematch = () => getSocket().emit("game:rematch");

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{matchOver ? "Partie terminée" : "Temps écoulé"}</Text>
      <Text style={styles.title}>{title}</Text>
      {you ? (
        <Text style={styles.sub}>
          {matchOver ? (
            <>
              Score final : <Text style={styles.strong}>{you.totalScore} pts</Text>
            </>
          ) : (
            <>
              Cette manche : <Text style={styles.strong}>{you.roundScore} pts</Text>
              {" · "}
              Total : <Text style={styles.strong}>{you.totalScore} pts</Text>
            </>
          )}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {room.observing ? (
          <Text style={styles.hint}>Tu observes la synthèse.</Text>
        ) : matchOver ? (
          isHost ? (
            <Pressable
              style={[styles.btn, styles.btnGold, starting && styles.disabled]}
              disabled={starting}
              onPress={() => {
                if (starting) return;
                setStarting(true);
                onRematch();
              }}
            >
              <Text style={styles.btnGoldText}>Nouvelle partie</Text>
            </Pressable>
          ) : (
            <Text style={styles.hint}>En attente de l’hôte pour une nouvelle partie…</Text>
          )
        ) : (
          <>
            {remainingMs > 0 ? (
              <Text style={styles.timer}>
                Manche suivante dans <Text style={styles.strong}>{formatTime(remainingMs)}</Text>
              </Text>
            ) : null}
            <Pressable
              style={[styles.btn, youReady ? styles.btnGhost : styles.btnGold]}
              onPress={onReady}
            >
              <Text style={youReady ? styles.btnGhostText : styles.btnGoldText}>
                {youReady ? "Annuler" : solo ? "Manche suivante" : "Je suis prêt"}
              </Text>
            </Pressable>
            {!solo ? (
              <Text style={styles.hint}>
                {readyCount}/{connected.length} prêt{readyCount > 1 ? "s" : ""}
              </Text>
            ) : null}
          </>
        )}

        <Pressable style={[styles.btn, styles.btnGhost]} onPress={onLeave}>
          <Text style={styles.btnGhostText}>Quitter</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{matchOver ? "Palmarès" : "Classement"}</Text>
        {ranked.map((p, i) => (
          <View key={p.id} style={[styles.row, p.id === you?.id && styles.you]}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {p.name}
                {p.id === you?.id ? " (toi)" : ""}
                {!matchOver && readyIds.has(p.id) ? " · prêt" : ""}
              </Text>
              <Text style={styles.hint}>
                {matchOver
                  ? `${p.totalScore} pts`
                  : `+${p.roundScore} · ${p.wordCount} mot${p.wordCount > 1 ? "s" : ""}`}
              </Text>
            </View>
            <Text style={styles.pts}>{p.totalScore}</Text>
          </View>
        ))}
      </View>

      {room.you.words.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Tes mots</Text>
          <Text style={styles.words}>
            {room.you.words
              .map((w) => `${w.display}${w.shared ? "*" : ""} (${w.points})`)
              .join(" · ")}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 24 },
  label: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.cream,
    lineHeight: 34,
  },
  sub: { color: colors.textSoft, fontSize: 16, lineHeight: 24 },
  strong: { color: colors.cream, fontWeight: "800" },
  actions: { gap: 10 },
  timer: { color: colors.textSoft, fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnGold: { backgroundColor: colors.gold },
  btnGhost: { borderWidth: 1, borderColor: colors.line },
  disabled: { opacity: 0.55 },
  btnGoldText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  btnGhostText: { color: colors.cream, fontWeight: "600", fontSize: 16 },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  you: {
    backgroundColor: "rgba(232,184,74,0.08)",
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  rank: { width: 22, color: colors.textMuted, fontWeight: "700" },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  name: { color: colors.cream, fontWeight: "700", fontSize: 15 },
  pts: { color: colors.gold, fontWeight: "800", fontSize: 16 },
  words: { color: colors.cream, fontSize: 14, lineHeight: 21 },
});
