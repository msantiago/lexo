import { useEffect, useRef, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import type { RoomView } from "@shared/types";
import AuthScreen from "./src/screens/AuthScreen";
import DailyScreen from "./src/screens/DailyScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LobbyScreen from "./src/screens/LobbyScreen";
import PlayScreen from "./src/screens/PlayScreen";
import PreferencesScreen from "./src/screens/PreferencesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ResultsScreen from "./src/screens/ResultsScreen";
import { authClient } from "./src/auth-client";
import {
  clearRoomSession,
  loadRoomSession,
  sameRoomSession,
  saveRoomSession,
  type RoomSession,
} from "./src/session";
import { connectSocket, getSocket, refreshSocketAuth, type ConnectionState } from "./src/socket";
import { colors } from "./src/theme";

type Screen = "home" | "auth" | "daily" | "profile" | "preferences";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dailyPlaying, setDailyPlaying] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasSignedIn = useRef(false);
  const roomRef = useRef<RoomView | null>(null);
  const pendingRejoin = useRef<RoomSession | null>(null);
  const { data: session } = authClient.useSession();
  roomRef.current = room;

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
    void clearRoomSession();
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
      const onSession = (data: RoomSession) => {
        pendingRejoin.current = null;
        setPlayerId(data.playerId);
        void saveRoomSession(data);
      };
      const onClosed = () => {
        void clearRoomSession();
        clearRoom();
        showToast("Salon fermé");
      };
      const onReplaced = () => {
        void clearRoomSession();
        clearRoom();
        showToast("Session reprise sur un autre appareil");
      };
      const onNotice = async (data: { message: string }) => {
        const message = data.message;
        if (
          message === "Connecte-toi pour jouer" ||
          message === "Ce compte joue sur un autre appareil" ||
          message.startsWith("Tu as été retiré du salon")
        ) {
          await clearRoomSession();
          clearRoom();
          showToast(message, 3500);
          return;
        }
        if (message === "Salon introuvable" || message === "Joueur introuvable") {
          const attempted = pendingRejoin.current;
          pendingRejoin.current = null;
          if (roomRef.current) return;
          const stored = await loadRoomSession();
          if (sameRoomSession(attempted, stored)) {
            await clearRoomSession();
            clearRoom();
          }
          return;
        }
        showToast(message);
      };
      const tryRejoin = () => {
        void loadRoomSession().then((existing) => {
          pendingRejoin.current = existing;
          if (existing) getSocket().emit("room:rejoin", existing);
        });
      };

      if (socket.connected) setConnection("connected");
      socket.on("connect", onConnect);
      socket.on("connect", tryRejoin);
      socket.on("disconnect", onDisconnect);
      socket.on("room:state", onRoom);
      socket.on("session", onSession);
      socket.on("room:closed", onClosed);
      socket.on("session:replaced", onReplaced);
      socket.on("notice", onNotice);
      if (socket.connected) tryRejoin();
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
    void clearRoomSession();
    clearRoom();
    setScreen("home");
  }, [session?.user]);

  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const playing = room?.phase === "playing";
  const results = room?.phase === "results";
  const lobby = room?.phase === "lobby";

  const signOut = async () => {
    await authClient.signOut();
    await refreshSocketAuth();
    await clearRoomSession();
    clearRoom();
    setScreen("home");
  };

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
  ) : screen === "daily" ? (
    <DailyScreen onBack={() => setScreen("home")} onPlayingChange={setDailyPlaying} />
  ) : screen === "profile" ? (
    <ProfileScreen
      onBack={() => setScreen("home")}
      onPreferences={() => setScreen("preferences")}
      onSignOut={() => void signOut()}
    />
  ) : screen === "preferences" ? (
    <PreferencesScreen onBack={() => setScreen("profile")} />
  ) : (
    <HomeScreen
      connection={connection}
      onNeedAuth={() => setScreen("auth")}
      onDaily={() => setScreen("daily")}
      onProfile={() => setScreen("profile")}
      toast={toast}
    />
  );

  if (playing || dailyPlaying) {
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
