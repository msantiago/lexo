import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme";

export function ScoreArrow({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 12h13.5M13 6.5 19.5 12 13 17.5"
        fill="none"
        stroke={colors.goldSoft}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type Props = {
  roundScore: number;
  totalScore: number;
  matchOnly?: boolean;
  /** compact : adversaires. prominent : son propre score au-dessus de la grille. */
  size?: "compact" | "prominent";
};

export default function PlayerScore({ roundScore, totalScore, matchOnly, size }: Props) {
  const prominent = size === "prominent";
  const compact = size === "compact";
  if (matchOnly) {
    return (
      <Text
        style={[styles.total, prominent && styles.totalProminent, compact && styles.totalCompact]}
        accessibilityLabel={`${totalScore} points sur la partie`}
      >
        {totalScore}
      </Text>
    );
  }

  return (
    <View
      style={styles.pair}
      accessibilityLabel={`plus ${roundScore} cette manche, ${totalScore} sur la partie`}
    >
      <Text style={[styles.round, prominent && styles.roundProminent, compact && styles.roundCompact]}>
        +{roundScore}
      </Text>
      <ScoreArrow size={prominent ? 18 : compact ? 11 : 14} />
      <Text style={[styles.total, prominent && styles.totalProminent, compact && styles.totalCompact]}>
        {totalScore}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", alignItems: "center", gap: 4 },
  round: { color: colors.cream, fontSize: 15, fontWeight: "700" },
  roundProminent: { fontSize: 22 },
  roundCompact: { fontSize: 12 },
  total: { color: colors.gold, fontSize: 18, fontWeight: "800" },
  totalProminent: { fontSize: 28 },
  totalCompact: { fontSize: 14 },
});
