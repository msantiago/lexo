import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { GameHistoryItem, ProfilePayload } from "@shared/account";
import { difficultyLabel } from "@shared/rules";
import { apiFetch } from "../api";
import { authClient, displayNameFromUser } from "../auth-client";
import { colors } from "../theme";

type Props = {
  onBack: () => void;
  onPreferences: () => void;
  onSignOut: () => void;
};

export default function ProfileScreen({ onBack, onPreferences, onSignOut }: Props) {
  const { data: session } = authClient.useSession();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"badges" | "stats" | "games">("badges");

  const name = displayNameFromUser(session?.user?.name, session?.user?.email);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/me/profile")
      .then(async (res) => {
        if (!res.ok) throw new Error("Impossible de charger le profil.");
        return res.json() as Promise<ProfilePayload>;
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile && !error) {
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
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.sub}>{session?.user?.email}</Text>

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnIvory]} onPress={onPreferences}>
          <Text style={styles.btnIvoryText}>Préférences</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={onSignOut}>
          <Text style={styles.btnGhostText}>Se déconnecter</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {profile ? (
        <>
          <View style={styles.tabs}>
            {(["badges", "stats", "games"] as const).map((id) => (
              <Pressable key={id} style={[styles.tab, tab === id && styles.tabOn]} onPress={() => setTab(id)}>
                <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>
                  {id === "badges" ? "Badges" : id === "stats" ? "Stats" : "Parties"}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "badges" ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Badges ({profile.badges.filter((b) => b.earnedAt).length}/{profile.badges.length})
              </Text>
              {profile.badges.filter((b) => b.earnedAt).length === 0 ? (
                <Text style={styles.hint}>Pas encore de badge — joue pour en débloquer.</Text>
              ) : (
                profile.badges
                  .filter((b) => b.earnedAt)
                  .map((badge) => (
                    <View key={badge.id} style={styles.badgeRow}>
                      <Text style={styles.badgeTitle}>{badge.title}</Text>
                      <Text style={styles.hint}>{badge.description}</Text>
                    </View>
                  ))
              )}
            </View>
          ) : null}

          {tab === "stats" ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Résumé</Text>
              <Stat label="Parties" value={profile.stats.gamesPlayed} />
              <Stat label="Manches" value={profile.stats.roundsPlayed} />
              <Stat label="Mots" value={profile.stats.wordsFound} />
              <Stat label="Points" value={profile.stats.totalPoints} />
              <Stat label="Victoires" value={profile.stats.wins} />
              <Stat label="Plus long mot" value={profile.stats.longestWord} />
            </View>
          ) : null}

          {tab === "games" ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Parties récentes</Text>
              {profile.games.length === 0 ? (
                <Text style={styles.hint}>Aucune partie enregistrée.</Text>
              ) : (
                profile.games.slice(0, 20).map((game) => <GameRow key={game.id} game={game} />)
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function GameRow({ game }: { game: GameHistoryItem }) {
  const kind =
    game.kind === "daily" ? "Lexo du jour" : game.solo ? "Solo" : "Multi";
  return (
    <View style={styles.gameRow}>
      <Text style={styles.gameTitle}>
        {kind} · {difficultyLabel(game.difficulty)}
      </Text>
      <Text style={styles.hint}>
        {new Date(game.createdAt).toLocaleDateString("fr-FR")} · {game.yourScore} pts ·{" "}
        {game.roundCount} manche{game.roundCount > 1 ? "s" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  center: { alignItems: "center", paddingVertical: 40 },
  back: { color: colors.goldSoft, fontWeight: "700", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "800", color: colors.cream },
  sub: { color: colors.textMuted, fontSize: 14 },
  actions: { gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnIvory: { backgroundColor: colors.ivory },
  btnGhost: { borderWidth: 1, borderColor: colors.line },
  btnIvoryText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  btnGhostText: { color: colors.cream, fontWeight: "600", fontSize: 16 },
  error: { color: colors.coral },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.textSoft, fontWeight: "700", fontSize: 13 },
  tabTextOn: { color: colors.ink },
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
  badgeRow: { gap: 2, paddingVertical: 4 },
  badgeTitle: { color: colors.cream, fontWeight: "700", fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  statLabel: { color: colors.textSoft },
  statValue: { color: colors.gold, fontWeight: "800" },
  gameRow: { gap: 2, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  gameTitle: { color: colors.cream, fontWeight: "700" },
});
