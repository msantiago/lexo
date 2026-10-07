import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  authClient,
  authErrorMessage,
  sanitizePseudo,
} from "../auth-client";
import { refreshSocketAuth } from "../socket";
import { colors } from "../theme";

type Mode = "signin" | "signup";

type Props = {
  onDone: () => void;
};

export default function AuthScreen({ onDone }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: sanitizePseudo(name) || "Joueur",
        });
        if (result.error) {
          setError(authErrorMessage(result.error));
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe: true,
        });
        if (result.error) {
          setError(authErrorMessage(result.error));
          return;
        }
      }
      await refreshSocketAuth();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{mode === "signup" ? "Créer un compte" : "Se connecter"}</Text>
      <Text style={styles.lead}>
        Un compte est obligatoire pour créer un salon, jouer en solo ou rejoindre une partie.
      </Text>

      {mode === "signup" ? (
        <TextInput
          style={styles.input}
          placeholder="Prénom / pseudo"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
          maxLength={16}
        />
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoComplete={mode === "signup" ? "new-password" : "password"}
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.btn, styles.btnGold, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void submit()}
      >
        {busy ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.btnGoldText}>{mode === "signup" ? "Créer le compte" : "Connexion"}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setError(null);
          setMode(mode === "signup" ? "signin" : "signup");
        }}
      >
        <Text style={styles.switch}>
          {mode === "signup" ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S’inscrire"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.cream,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSoft,
    marginBottom: 4,
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
  error: {
    color: colors.coral,
    fontSize: 14,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnGold: {
    backgroundColor: colors.gold,
  },
  btnDisabled: { opacity: 0.6 },
  btnGoldText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 16,
  },
  switch: {
    color: colors.goldSoft,
    textAlign: "center",
    marginTop: 8,
    fontSize: 15,
  },
});
