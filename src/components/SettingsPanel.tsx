import { useState } from "react";
import { DIFFICULTY_BANDS, DIFFICULTY_OPTIONS, type GameSettings } from "@shared/types";
import { formatDuration } from "../lib/format";

type Props = {
  settings: GameSettings;
  disabled?: boolean;
  /** Affiche objectif et rejoindre en cours (salon multi uniquement). */
  multiplayer?: boolean;
  onChange: (next: GameSettings) => void;
};

export default function SettingsPanel({ settings, disabled, multiplayer, onChange }: Props) {
  const [more, setMore] = useState(false);
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });

  return (
    <section className="launch-rules">
      <div className="rule">
        <div className="rule-top">
          <span>Durée</span>
          <b>{formatDuration(settings.durationSec)}</b>
        </div>
        <input
          type="range"
          min={30}
          max={300}
          step={15}
          disabled={disabled}
          value={settings.durationSec}
          aria-label="Durée de la manche"
          onChange={(e) => set({ durationSec: Number(e.target.value) })}
        />
      </div>

      <div className="rule">
        <div className="rule-top">
          <span>Difficulté</span>
          <b>{difficultyHint(settings.difficulty)}</b>
        </div>
        <div className="segment" role="radiogroup" aria-label="Difficulté">
          {DIFFICULTY_OPTIONS.map((option) => (
            <Segment
              key={option.id}
              on={settings.difficulty === option.id}
              disabled={disabled}
              onClick={() => set({ difficulty: option.id })}
            >
              {option.label}
            </Segment>
          ))}
        </div>
      </div>

      {multiplayer && (
        <>
          <div className="rule">
            <div className="rule-top">
              <span>Objectif</span>
            </div>
            <div className="segment" role="radiogroup" aria-label="Type d’objectif">
              <Segment
                on={settings.objective === "rounds"}
                disabled={disabled}
                onClick={() => set({ objective: "rounds" })}
              >
                {`${settings.maxRounds} manches`}
              </Segment>
              <Segment
                on={settings.objective === "score"}
                disabled={disabled}
                onClick={() => set({ objective: "score" })}
              >
                {`${settings.targetScore} pts`}
              </Segment>
            </div>
            {settings.objective === "rounds" ? (
              <input
                className="rule-subsegment"
                type="range"
                min={3}
                max={20}
                step={1}
                disabled={disabled}
                value={settings.maxRounds}
                aria-label="Nombre de manches"
                onChange={(e) => set({ maxRounds: Number(e.target.value) })}
              />
            ) : (
              <input
                className="rule-subsegment"
                type="range"
                min={50}
                max={500}
                step={10}
                disabled={disabled}
                value={settings.targetScore}
                aria-label="Score à atteindre"
                onChange={(e) => set({ targetScore: Number(e.target.value) })}
              />
            )}
          </div>

          <div className="rule">
            <SwitchRow
              label="Rejoindre en cours"
              hint={
                settings.allowJoinMidGame
                  ? "De nouveaux joueurs pourront arriver après le lancement."
                  : "Personne ne pourra rejoindre une fois la partie lancée."
              }
              on={settings.allowJoinMidGame}
              disabled={disabled}
              onClick={() => set({ allowJoinMidGame: !settings.allowJoinMidGame })}
            />
          </div>
        </>
      )}

      <button
        type="button"
        className="rule-more"
        aria-expanded={more}
        onClick={() => setMore((open) => !open)}
      >
        {more ? "Moins de réglages" : "Autres réglages"}
      </button>

      {more && (
        <div className="rule-extra">
          <div className="rule">
            <div className="rule-top">
              <span>Lettres</span>
            </div>
            <div className="segment" role="radiogroup" aria-label="Orientation des lettres">
              <Segment
                on={settings.letterOrientation !== "shuffle"}
                disabled={disabled}
                onClick={() => set({ letterOrientation: "upright" })}
              >
                À l’endroit
              </Segment>
              <Segment
                on={settings.letterOrientation === "shuffle"}
                disabled={disabled}
                onClick={() => set({ letterOrientation: "shuffle" })}
              >
                Au hasard
              </Segment>
            </div>
          </div>

          <div className="rule">
            <div className="rule-top">
              <span>Longueur minimum</span>
            </div>
            <div className="segment" role="radiogroup" aria-label="Nombre minimum de lettres">
              {[3, 4, 5].map((n) => (
                <Segment
                  key={n}
                  on={settings.minLetters === n}
                  disabled={disabled}
                  onClick={() => set({ minLetters: n })}
                >
                  {`${n} lettres`}
                </Segment>
              ))}
            </div>
          </div>

          <SwitchRow
            label="Pluriels"
            on={settings.allowPlurals}
            disabled={disabled}
            onClick={() => set({ allowPlurals: !settings.allowPlurals })}
          />
          <SwitchRow
            label="Féminins"
            on={settings.allowFeminines}
            disabled={disabled}
            onClick={() => set({ allowFeminines: !settings.allowFeminines })}
          />

          <div className="rule">
            <div className="rule-top">
              <span>Verbes</span>
            </div>
            <div className="segment" role="radiogroup" aria-label="Conjugaisons">
              <Segment
                on={settings.conjugations === "participles"}
                disabled={disabled}
                onClick={() =>
                  set({
                    conjugations: "participles",
                    allowPastParticiple: true,
                    allowPresentParticiple: true,
                  })
                }
              >
                Participes
              </Segment>
              <Segment
                on={settings.conjugations === "all"}
                disabled={disabled}
                onClick={() => set({ conjugations: "all" })}
              >
                Toutes
              </Segment>
            </div>
          </div>

          {settings.conjugations === "participles" && (
            <>
              <SwitchRow
                label="Participe passé"
                on={settings.allowPastParticiple}
                disabled={disabled}
                onClick={() => {
                  if (settings.allowPastParticiple && !settings.allowPresentParticiple) return;
                  set({ allowPastParticiple: !settings.allowPastParticiple });
                }}
              />
              <SwitchRow
                label="Participe présent"
                on={settings.allowPresentParticiple}
                disabled={disabled}
                onClick={() => {
                  if (settings.allowPresentParticiple && !settings.allowPastParticiple) return;
                  set({ allowPresentParticiple: !settings.allowPresentParticiple });
                }}
              />
            </>
          )}
        </div>
      )}

      <p className="rules-score">Qu = Q ou Qu · 4 lettres = 1 pt, puis +1 · mot partagé = 0</p>
    </section>
  );
}

function difficultyHint(id: GameSettings["difficulty"]) {
  const { min, max } = DIFFICULTY_BANDS[id];
  if (!Number.isFinite(max)) return `Plus de ${min - 1} mots`;
  return `${min} à ${max} mots`;
}

function Segment({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      className={on ? "on" : ""}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SwitchRow({
  label,
  hint,
  on,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="rule-switch" disabled={disabled} onClick={onClick}>
      <span className="rule-switch-copy">
        <span className="rule-switch-label">{label}</span>
        {hint && <span className="rules-hint rule-switch-hint">{hint}</span>}
      </span>
      <span className={`switch ${on ? "on" : ""}`} aria-hidden>
        <i />
      </span>
    </button>
  );
}
