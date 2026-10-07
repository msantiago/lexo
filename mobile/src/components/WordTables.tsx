import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RoundSummary, SharedWord, SummaryWord } from "@shared/types";
import { getSocket } from "../socket";
import { colors } from "../theme";

type Props = {
  summary: RoundSummary;
  youId: string;
  observing?: boolean;
};

export default function WordTables({ summary, youId, observing }: Props) {
  const unique = [...summary.unique].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || b.points - a.points,
  );
  const shared = [...summary.shared].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <View style={styles.wrap}>
      {unique.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>Mots exclusifs</Text>
          {unique.map((word) => (
            <WordRow
              key={word.key}
              word={word}
              youId={youId}
              observing={observing}
              subtitle={`${word.name} · ${word.points} pts`}
            />
          ))}
        </View>
      ) : null}

      {shared.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>Mots partagés</Text>
          {shared.map((word) => (
            <SharedRow key={word.key} word={word} youId={youId} observing={observing} />
          ))}
        </View>
      ) : null}

      {summary.missed.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.title}>
            Mots possibles ({summary.possibleCount})
          </Text>
          <Text style={styles.missed}>
            {summary.missed
              .slice(0, 40)
              .map((w) => `${w.display} (${w.points})`)
              .join(" · ")}
            {summary.missed.length > 40 ? "…" : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function WordRow({
  word,
  youId,
  observing,
  subtitle,
}: {
  word: SummaryWord;
  youId: string;
  observing?: boolean;
  subtitle: string;
}) {
  const liked = word.likedBy.some((l) => l.playerId === youId);
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: word.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.word}>{word.display}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      {!observing ? (
        <Pressable onPress={() => getSocket().emit("chat:like", { key: word.key })}>
          <Text style={[styles.like, liked && styles.liked]}>
            ♥ {word.likedBy.length || ""}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SharedRow({
  word,
  youId,
  observing,
}: {
  word: SharedWord;
  youId: string;
  observing?: boolean;
}) {
  const liked = word.likedBy.some((l) => l.playerId === youId);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.word}>{word.display}</Text>
        <Text style={styles.sub}>{word.names.map((n) => n.name).join(", ")}</Text>
      </View>
      {!observing ? (
        <Pressable onPress={() => getSocket().emit("chat:like", { key: word.key })}>
          <Text style={[styles.like, liked && styles.liked]}>
            ♥ {word.likedBy.length || ""}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  word: { color: colors.cream, fontWeight: "700", fontSize: 15 },
  sub: { color: colors.textMuted, fontSize: 13 },
  like: { color: colors.textMuted, fontWeight: "700" },
  liked: { color: colors.coral },
  missed: { color: colors.cream, fontSize: 13, lineHeight: 20 },
});
