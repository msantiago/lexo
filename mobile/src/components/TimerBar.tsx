import { StyleSheet, Text, View } from "react-native";
import { formatTime } from "../lib/format";
import { colors } from "../theme";

type Props = {
  remainingMs: number;
  totalMs: number;
};

export default function TimerBar({ remainingMs, totalMs }: Props) {
  const ratio = Math.min(1, Math.max(0, totalMs > 0 ? remainingMs / totalMs : 0));
  const urgent = remainingMs <= 10_000;

  return (
    <View
      style={[styles.track, urgent && styles.urgent]}
      accessibilityRole="timer"
      accessibilityLabel={`Temps restant ${formatTime(remainingMs)}`}
    >
      <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
      <Text style={[styles.time, urgent && styles.timeUrgent]}>{formatTime(remainingMs)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    justifyContent: "center",
  },
  urgent: {
    borderColor: "rgba(255,93,74,0.55)",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(232,184,74,0.35)",
  },
  time: {
    textAlign: "center",
    color: colors.cream,
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  timeUrgent: {
    color: colors.coral,
  },
});
