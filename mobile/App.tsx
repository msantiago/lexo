import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { DEFAULT_SETTINGS } from "@shared/types";
import { summarizeRules } from "@shared/rules";
import { apiBaseUrl, getSocket, type ConnectionState } from "./src/socket";
import { colors } from "./src/theme";

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const rules = summarizeRules(DEFAULT_SETTINGS, false);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnection("connected");
    const onDisconnect = () => setConnection("disconnected");

    if (socket.connected) setConnection("connected");
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const statusLabel =
    connection === "connected"
      ? "Connecté au serveur Lexo"
      : connection === "connecting"
        ? "Connexion au serveur…"
        : "Serveur injoignable";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.brand} accessibilityRole="header">
            L E X O
          </Text>
          <Text style={styles.tagline}>Jeu de lettres en temps réel — édition mobile</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Règles par défaut</Text>
          <Text style={styles.panelBody}>{rules}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Backend</Text>
          <View style={styles.row}>
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
            <Text style={styles.panelBody}>{statusLabel}</Text>
          </View>
          <Text style={styles.mono}>{apiBaseUrl()}</Text>
          <Text style={styles.hint}>
            Lance le serveur Lexo (`npm run dev:server`) puis définis `EXPO_PUBLIC_API_URL` si
            besoin.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.feltDark,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    gap: 20,
  },
  hero: {
    gap: 10,
    paddingVertical: 24,
  },
  brand: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 8,
    color: colors.gold,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSoft,
    maxWidth: 340,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.goldSoft,
  },
  panelBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.cream,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOk: { backgroundColor: "#6fdb9a" },
  dotPending: { backgroundColor: colors.gold },
  dotBad: { backgroundColor: colors.coral },
  mono: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: "monospace",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
