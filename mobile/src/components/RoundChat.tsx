import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ChatMessage } from "@shared/types";
import { getSocket } from "../socket";
import { colors } from "../theme";

type Props = {
  chat: ChatMessage[];
  disabled?: boolean;
};

export default function RoundChat({ chat, disabled }: Props) {
  const [text, setText] = useState("");
  const send = () => {
    const next = text.trim();
    if (!next || disabled) return;
    getSocket().emit("chat:send", { text: next });
    setText("");
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Chat</Text>
      {chat.length === 0 ? (
        <Text style={styles.hint}>Aucun message pour l’instant.</Text>
      ) : (
        chat.slice(-40).map((msg) => (
          <View key={msg.id} style={styles.row}>
            {msg.kind === "text" ? (
              <Text style={styles.line}>
                <Text style={[styles.name, { color: msg.color || colors.gold }]}>{msg.name}</Text>
                {" · "}
                <Text style={styles.body}>{msg.text}</Text>
              </Text>
            ) : msg.kind === "like" && msg.word ? (
              <Text style={styles.hint}>
                {msg.name} aime {msg.word.display}
              </Text>
            ) : msg.kind === "badge" && msg.badge ? (
              <Text style={styles.hint}>
                {msg.name} · {msg.badge.title}
              </Text>
            ) : (
              <Text style={styles.hint}>{msg.text || "…"}</Text>
            )}
          </View>
        ))
      )}
      {!disabled ? (
        <View style={styles.compose}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Écrire…"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable style={styles.send} onPress={send}>
            <Text style={styles.sendText}>OK</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.goldSoft,
  },
  row: { paddingVertical: 2 },
  line: { color: colors.cream, fontSize: 14, lineHeight: 20 },
  name: { fontWeight: "700" },
  body: { color: colors.cream },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  compose: { flexDirection: "row", gap: 8, marginTop: 4 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.cream,
    fontSize: 15,
  },
  send: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  sendText: { color: colors.ink, fontWeight: "700" },
});
