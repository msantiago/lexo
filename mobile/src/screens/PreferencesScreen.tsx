import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  AVATAR_PRESETS,
  LETTER_AVATAR_ID,
  encodeAvatar,
  parseAvatarId,
} from "@shared/avatars";
import { authClient, authErrorMessage, displayNameFromUser, sanitizePseudo } from "../auth-client";
import { colors } from "../theme";

type Props = {
  onBack: () => void;
};

export default function PreferencesScreen({ onBack }: Props) {
  const { data: session } = authClient.useSession();
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(LETTER_AVATAR_ID);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = useMemo(
    () => displayNameFromUser(session?.user?.name, session?.user?.email),
    [session?.user?.name, session?.user?.email],
  );

  useEffect(() => {
    setName(sanitizePseudo(session?.user?.name) || label);
    setAvatarId(parseAvatarId(session?.user?.image ?? null));
  }, [session?.user?.name, session?.user?.image, label]);

  const saveName = async () => {
    const next = sanitizePseudo(name);
    if (!next) {
      setError("Choisis un pseudo.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await authClient.updateUser({ name: next });
    setBusy(false);
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setMessage("Pseudo enregistré.");
  };

  const saveAvatar = async (id: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await authClient.updateUser({ image: encodeAvatar(id) });
    setBusy(false);
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setAvatarId(id);
    setMessage("Avatar enregistré.");
  };

  if (!session?.user) {
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
      <Text style={styles.title}>Préférences</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Pseudo</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={16}
          placeholder="Ton pseudo"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={[styles.btn, styles.btnGold, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void saveName()}
        >
          <Text style={styles.btnGoldText}>Enregistrer</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Avatar</Text>
        <View style={styles.avatars}>
          <Pressable
            style={[styles.avatar, avatarId === LETTER_AVATAR_ID && styles.avatarOn]}
            disabled={busy}
            onPress={() => void saveAvatar(LETTER_AVATAR_ID)}
          >
            <Text style={styles.avatarLetter}>{(label[0] || "?").toUpperCase()}</Text>
          </Pressable>
          {AVATAR_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              style={[styles.avatar, avatarId === preset.id && styles.avatarOn]}
              disabled={busy}
              onPress={() => void saveAvatar(preset.id)}
            >
              <Text style={styles.avatarEmoji}>{preset.emoji ?? "◆"}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  center: { alignItems: "center", paddingVertical: 40 },
  back: { color: colors.goldSoft, fontWeight: "700", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "800", color: colors.cream },
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
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontSize: 16,
  },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnGold: { backgroundColor: colors.gold },
  btnGoldText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.55 },
  avatars: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  avatarOn: { borderColor: colors.gold },
  avatarLetter: { color: colors.cream, fontWeight: "800", fontSize: 20 },
  avatarEmoji: { fontSize: 22 },
  error: { color: colors.coral },
  ok: { color: "#6fdb9a" },
});
