import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DIFFICULTY_BANDS, DIFFICULTY_OPTIONS, type GameSettings } from "@shared/types";
import { formatDuration } from "../lib/format";
import { colors } from "../theme";

type Props = {
  settings: GameSettings;
  disabled?: boolean;
  multiplayer?: boolean;
  onChange: (next: GameSettings) => void;
};

export default function SettingsPanel({ settings, disabled, multiplayer, onChange }: Props) {
  const [more, setMore] = useState(false);
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });

  return (
    <View style={styles.wrap}>
      <Rule label="Durée" value={formatDuration(settings.durationSec)}>
        <SegmentRow>
          {[60, 120, 180, 240, 300].map((sec) => (
            <Seg
              key={sec}
              on={settings.durationSec === sec}
              disabled={disabled}
              onPress={() => set({ durationSec: sec })}
              label={formatDuration(sec)}
            />
          ))}
        </SegmentRow>
      </Rule>

      <Rule label="Difficulté" value={difficultyHint(settings.difficulty)}>
        <SegmentRow>
          {DIFFICULTY_OPTIONS.map((option) => (
            <Seg
              key={option.id}
              on={settings.difficulty === option.id}
              disabled={disabled}
              onPress={() => set({ difficulty: option.id })}
              label={option.label}
            />
          ))}
        </SegmentRow>
      </Rule>

      {multiplayer ? (
        <>
          <Rule label="Objectif">
            <SegmentRow>
              <Seg
                on={settings.objective === "rounds"}
                disabled={disabled}
                onPress={() => set({ objective: "rounds" })}
                label={`${settings.maxRounds} manches`}
              />
              <Seg
                on={settings.objective === "score"}
                disabled={disabled}
                onPress={() => set({ objective: "score" })}
                label={`${settings.targetScore} pts`}
              />
            </SegmentRow>
            {settings.objective === "rounds" ? (
              <SegmentRow>
                {[3, 5, 7, 10, 15, 20].map((n) => (
                  <Seg
                    key={n}
                    on={settings.maxRounds === n}
                    disabled={disabled}
                    onPress={() => set({ maxRounds: n })}
                    label={String(n)}
                  />
                ))}
              </SegmentRow>
            ) : (
              <SegmentRow>
                {[50, 100, 150, 200, 300, 500].map((n) => (
                  <Seg
                    key={n}
                    on={settings.targetScore === n}
                    disabled={disabled}
                    onPress={() => set({ targetScore: n })}
                    label={String(n)}
                  />
                ))}
              </SegmentRow>
            )}
          </Rule>

          <SwitchRow
            label="Rejoindre en cours"
            hint={
              settings.allowJoinMidGame
                ? "De nouveaux joueurs pourront arriver après le lancement."
                : "Personne ne pourra rejoindre une fois la partie lancée."
            }
            on={settings.allowJoinMidGame}
            disabled={disabled}
            onPress={() => set({ allowJoinMidGame: !settings.allowJoinMidGame })}
          />
        </>
      ) : null}

      <Pressable onPress={() => setMore((v) => !v)}>
        <Text style={styles.more}>{more ? "Moins de réglages" : "Autres réglages"}</Text>
      </Pressable>

      {more ? (
        <View style={styles.extra}>
          <Rule label="Lettres">
            <SegmentRow>
              <Seg
                on={settings.letterOrientation !== "shuffle"}
                disabled={disabled}
                onPress={() => set({ letterOrientation: "upright" })}
                label="À l’endroit"
              />
              <Seg
                on={settings.letterOrientation === "shuffle"}
                disabled={disabled}
                onPress={() => set({ letterOrientation: "shuffle" })}
                label="Au hasard"
              />
            </SegmentRow>
          </Rule>

          <Rule label="Longueur minimum">
            <SegmentRow>
              {[3, 4, 5].map((n) => (
                <Seg
                  key={n}
                  on={settings.minLetters === n}
                  disabled={disabled}
                  onPress={() => set({ minLetters: n })}
                  label={`${n} lettres`}
                />
              ))}
            </SegmentRow>
          </Rule>

          <SwitchRow
            label="Pluriels"
            on={settings.allowPlurals}
            disabled={disabled}
            onPress={() => set({ allowPlurals: !settings.allowPlurals })}
          />
          <SwitchRow
            label="Féminins"
            on={settings.allowFeminines}
            disabled={disabled}
            onPress={() => set({ allowFeminines: !settings.allowFeminines })}
          />

          <Rule label="Verbes">
            <SegmentRow>
              <Seg
                on={settings.conjugations === "participles"}
                disabled={disabled}
                onPress={() =>
                  set({
                    conjugations: "participles",
                    allowPastParticiple: true,
                    allowPresentParticiple: true,
                  })
                }
                label="Participes"
              />
              <Seg
                on={settings.conjugations === "all"}
                disabled={disabled}
                onPress={() => set({ conjugations: "all" })}
                label="Toutes"
              />
            </SegmentRow>
          </Rule>

          {settings.conjugations === "participles" ? (
            <>
              <SwitchRow
                label="Participe passé"
                on={settings.allowPastParticiple}
                disabled={disabled}
                onPress={() => {
                  if (settings.allowPastParticiple && !settings.allowPresentParticiple) return;
                  set({ allowPastParticiple: !settings.allowPastParticiple });
                }}
              />
              <SwitchRow
                label="Participe présent"
                on={settings.allowPresentParticiple}
                disabled={disabled}
                onPress={() => {
                  if (settings.allowPresentParticiple && !settings.allowPastParticiple) return;
                  set({ allowPresentParticiple: !settings.allowPresentParticiple });
                }}
              />
            </>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.hint}>Qu = Q ou Qu · 4 lettres = 1 pt, puis +1 · mot partagé = 0</Text>
    </View>
  );
}

function difficultyHint(id: GameSettings["difficulty"]) {
  const { min, max } = DIFFICULTY_BANDS[id];
  if (!Number.isFinite(max)) return `Plus de ${min - 1} mots`;
  return `${min} à ${max} mots`;
}

function Rule({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleTop}>
        <Text style={styles.ruleLabel}>{label}</Text>
        {value ? <Text style={styles.ruleValue}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SegmentRow({ children }: { children: ReactNode }) {
  return <View style={styles.segment}>{children}</View>;
}

function Seg({
  on,
  disabled,
  onPress,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      style={[styles.seg, on && styles.segOn, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
    </Pressable>
  );
}

function SwitchRow({
  label,
  hint,
  on,
  disabled,
  onPress,
}: {
  label: string;
  hint?: string;
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.switchRow, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.ruleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  rule: { gap: 8 },
  ruleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ruleLabel: { color: colors.cream, fontWeight: "700", fontSize: 14 },
  ruleValue: { color: colors.goldSoft, fontWeight: "600", fontSize: 13 },
  segment: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seg: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  segText: { color: colors.textSoft, fontSize: 13, fontWeight: "600" },
  segTextOn: { color: colors.ink },
  more: { color: colors.gold, fontWeight: "700", fontSize: 14 },
  extra: { gap: 12 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  switch: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,246,234,0.16)",
    padding: 3,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: colors.gold },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.cream,
  },
  knobOn: { alignSelf: "flex-end" },
  disabled: { opacity: 0.5 },
});
