import { useEffect, useRef, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import type { RoomView } from "@shared/types";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LobbyScreen from "./src/screens/LobbyScreen";
import PlayScreen from "./src/screens/PlayScreen";
import ResultsScreen from "./src/screens/ResultsScreen";
import { authClient } from "./src/auth-client";
import { connectSocket, getSocket, type ConnectionState } from "./src/socket";
import { colors } from "./src/theme";

type Screen = "home" | "auth";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasSignedIn = useRef(false);
  const { data: session } = authClient.useSession();

  const showToast = (message: string, ms = 2800) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const clearRoom = () => {
    setRoom(null);
    setPlayerId(null);
  };

  const leaveRoom = () => {
    getSocket().emit("room:leave");
    clearRoom();
    setScreen("home");
  };

  useEffect(() => {
    let cancelled = false;
    void connectSocket().then((socket) => {
      if (cancelled) return;

      const onConnect = () => setConnection("connected");
      const onDisconnect = () => setConnection("disconnected");
      const onRoom = (next: RoomView) => setRoom(next);
      const onSession = (data: { playerId: string }) => setPlayerId(data.playerId);
      const onClosed = () => {
        clearRoom();
        showToast("Salon fermé");
      };
      const onReplaced = () => {
        clearRoom();
        showToast("Session reprise sur un autre appareil");
      };
      const onNotice = (data: { message: string }) => showToast(data.message);

      if (socket.connected) setConnection("connected");
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("room:state", onRoom);
      socket.on("session", onSession);
      socket.on("room:closed", onClosed);
      socket.on("session:replaced", onReplaced);
      socket.on("notice", onNotice);
    });

    return () => {
      cancelled = true;
      const socket = getSocket();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room:state");
      socket.off("session");
      socket.off("room:closed");
      socket.off("session:replaced");
      socket.off("notice");
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      wasSignedIn.current = true;
      return;
    }
    if (!wasSignedIn.current) return;
    wasSignedIn.current = false;
    getSocket().emit("room:leave");
    clearRoom();
    setScreen("home");
  }, [session?.user]);

  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const playing = room?.phase === "playing";
  const results = room?.phase === "results";
  const lobby = room?.phase === "lobby";

  const body = playing && room ? (
    <PlayScreen room={room} onLeave={leaveRoom} />
  ) : results && room ? (
    <ResultsScreen room={room} isHost={isHost} onLeave={leaveRoom} />
  ) : lobby && room ? (
    <LobbyScreen room={room} playerId={playerId} onLeave={leaveRoom} />
  ) : screen === "auth" ? (
    <View style={styles.wrap}>
      <Text style={styles.brand}>L E X O</Text>
      <AuthScreen onDone={() => setScreen("home")} />
      <Text style={styles.link} onPress={() => setScreen("home")}>
        Retour
      </Text>
    </View>
  ) : (
    <HomeScreen
      connection={connection}
      onNeedAuth={() => setScreen("auth")}
      toast={toast}
    />
  );

  // Play needs a non-scrolling container so the board can capture gestures.
  if (playing) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.playPad}>{body}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {body}
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
    paddingTop: 28,
    paddingBottom: 48,
    flexGrow: 1,
  },
  playPad: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  wrap: { gap: 14 },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.gold,
    marginBottom: 4,
  },
  link: {
    color: colors.goldSoft,
    fontSize: 15,
    marginTop: 8,
  },
});
