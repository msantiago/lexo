import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { LobbyRoom } from "@shared/types";
import { difficultyLabel } from "@shared/rules";
import { authClient, displayNameFromUser } from "../auth-client";
import { getSocket, refreshSocketAuth, type ConnectionState } from "../socket";
import { colors } from "../theme";

type Props = {
  connection: ConnectionState;
  onNeedAuth: () => void;
  toast: string | null;
};

export default function HomeScreen({ connection, onNeedAuth, toast }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const name = useMemo(
    () => displayNameFromUser(session?.user?.name, session?.user?.email),
    [session?.user?.name, session?.user?.email],
  );
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    const socket = getSocket();
    const onRooms = (next: LobbyRoom[]) => setRooms(next);
    socket.on("lobby:rooms", onRooms);
    if (socket.connected) socket.emit("lobby:list");
    return () => {
      socket.off("lobby:rooms", onRooms);
    };
  }, []);

  useEffect(() => {
    if (connection === "connected") {
      getSocket().emit("lobby:list");
    }
  }, [connection]);

  const requireAuth = () => {
    if (!signedIn) {
      onNeedAuth();
      return false;
    }
    return true;
  };

  const create = (solo: boolean) => {
    if (!requireAuth()) return;
    setBusy(true);
    getSocket().emit("room:create", { name, solo });
    setTimeout(() => setBusy(false), 800);
  };

  const join = () => {
    if (!requireAuth()) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    getSocket().emit("room:join", { code, name });
    setTimeout(() => setBusy(false), 800);
  };

  const signOut = async () => {
    setBusy(true);
    await authClient.signOut();
    await refreshSocketAuth();
    setBusy(false);
  };

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.hint}>Chargement du compte…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.brand} accessibilityRole="header">
          L E X O
        </Text>
        <Text style={styles.tagline}>
          {signedIn ? `Bonjour, ${name}` : "Connecte-toi pour jouer"}
        </Text>
      </View>

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <View style={styles.rowStatus}>
        <View
          style={[
            styles.dot,
            connection === "connected"
              ? styles.dotOk
              : connection === "connecting"
                ? styles.dotPending
                : styles.dotBad,
          ]}
        />
        <Text style={styles.hint}>
          {connection === "connected"
            ? "Serveur connecté"
            : connection === "connecting"
              ? "Connexion…"
              : "Serveur injoignable"}
        </Text>
      </View>

      {!signedIn ? (
        <Pressable style={[styles.btn, styles.btnGold]} onPress={onNeedAuth}>
          <Text style={styles.btnGoldText}>Se connecter / Créer un compte</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnGold, busy && styles.btnDisabled]}
              disabled={busy || connection !== "connected"}
              onPress={() => create(true)}
            >
              <Text style={styles.btnGoldText}>Partie solo</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnIvory, busy && styles.btnDisabled]}
              disabled={busy || connection !== "connected"}
              onPress={() => create(false)}
            >
              <Text style={styles.btnIvoryText}>Créer un salon</Text>
            </Pressable>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Rejoindre</Text>
            <View style={styles.joinRow}>
              <TextInput
                style={styles.input}
                placeholder="Code"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={setJoinCode}
                maxLength={8}
              />
              <Pressable
                style={[styles.btn, styles.btnGold, styles.joinBtn, busy && styles.btnDisabled]}
                disabled={busy || connection !== "connected"}
                onPress={join}
              >
                <Text style={styles.btnGoldText}>OK</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Salons ouverts</Text>
            {rooms.length === 0 ? (
              <Text style={styles.hint}>Aucun salon public pour l’instant.</Text>
            ) : (
              rooms.map((room) => (
                <Pressable
                  key={room.code}
                  style={styles.roomRow}
                  disabled={busy || connection !== "connected"}
                  onPress={() => {
                    if (!requireAuth()) return;
                    setBusy(true);
                    getSocket().emit("room:join", { code: room.code, name });
                    setTimeout(() => setBusy(false), 800);
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.roomCode}>{room.code}</Text>
                    <Text style={styles.hint}>
                      {room.solo ? "Solo" : "Multi"} · {difficultyLabel(room.difficulty)} ·{" "}
                      {room.playerCount} joueur{room.playerCount > 1 ? "s" : ""}
                      {room.mine ? " · ta table" : ""}
                    </Text>
                  </View>
                  <Text style={styles.joinLink}>Rejoindre</Text>
                </Pressable>
              ))
            )}
          </View>

          <Pressable onPress={() => void signOut()} disabled={busy}>
            <Text style={styles.signOut}>Se déconnecter</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  center: { gap: 12, alignItems: "center", paddingVertical: 40 },
  hero: { gap: 8, paddingVertical: 8 },
  brand: {
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: 8,
    color: colors.gold,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSoft,
  },
  toast: {
    backgroundColor: "rgba(232,184,74,0.16)",
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  toastText: { color: colors.cream, fontSize: 14 },
  rowStatus: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOk: { backgroundColor: "#6fdb9a" },
  dotPending: { backgroundColor: colors.gold },
  dotBad: { backgroundColor: colors.coral },
  actions: { gap: 10 },
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
  joinRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontSize: 16,
    letterSpacing: 2,
  },
  joinBtn: { paddingHorizontal: 18, justifyContent: "center" },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  roomCode: { color: colors.cream, fontWeight: "700", fontSize: 17, letterSpacing: 1 },
  joinLink: { color: colors.gold, fontWeight: "700" },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnGold: { backgroundColor: colors.gold },
  btnIvory: {
    backgroundColor: colors.ivory,
  },
  btnDisabled: { opacity: 0.55 },
  btnGoldText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  btnIvoryText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  signOut: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    fontSize: 14,
  },
});
