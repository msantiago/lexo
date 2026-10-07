import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RoomView } from "@shared/types";
import { summarizeRules } from "@shared/rules";
import { getSocket } from "../socket";
import { colors } from "../theme";

type Props = {
  room: RoomView;
  playerId: string | null;
  onLeave: () => void;
};

export default function LobbyScreen({ room, playerId, onLeave }: Props) {
  const [starting, setStarting] = useState(false);
  const isHost = Boolean(playerId && room.hostId === playerId);
  const canStart = isHost && !room.observing;

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>L E X O</Text>
      <Text style={styles.code}>Salon {room.code}</Text>
      <Text style={styles.meta}>{room.solo ? "Partie solo" : "Partie multi"}</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Joueurs</Text>
        {room.players.map((player) => (
          <View key={player.id} style={styles.playerRow}>
            <View style={[styles.swatch, { backgroundColor: player.color }]} />
            <Text style={[styles.playerName, !player.connected && styles.offline]}>
              {player.name}
              {player.id === room.hostId ? " · hôte" : ""}
              {!player.connected ? " (hors ligne)" : ""}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Règles</Text>
        <Text style={styles.body}>{summarizeRules(room.settings, !room.solo)}</Text>
      </View>

      {room.observing ? (
        <Text style={styles.hint}>Tu observes ce salon. La partie commencera sans toi.</Text>
      ) : canStart ? (
        <Pressable
          style={[styles.btn, styles.btnGold, starting && styles.btnDisabled]}
          disabled={starting}
          onPress={() => {
            if (starting) return;
            setStarting(true);
            getSocket().emit("game:start");
          }}
        >
          <Text style={styles.btnGoldText}>
            {room.players.length === 1 ? "C’est parti" : `C’est parti · ${room.players.length}`}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.hint}>En attente de l’hôte…</Text>
      )}

      <Pressable style={[styles.btn, styles.btnGhost]} onPress={onLeave}>
        <Text style={styles.btnGhostText}>Quitter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.gold,
  },
  code: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.cream,
  },
  meta: { color: colors.textSoft, fontSize: 15 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.goldSoft,
  },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  playerName: { color: colors.cream, fontSize: 16, fontWeight: "600" },
  offline: { color: colors.textMuted },
  body: { color: colors.cream, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnGold: { backgroundColor: colors.gold },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnDisabled: { opacity: 0.55 },
  btnGoldText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  btnGhostText: { color: colors.cream, fontWeight: "600", fontSize: 16 },
});
