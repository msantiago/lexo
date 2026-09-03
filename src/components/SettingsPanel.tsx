import { DIFFICULTY_BANDS, DIFFICULTY_OPTIONS, type GameSettings } from "@shared/types";
import { formatDuration } from "../lib/format";

type Props = {
  settings: GameSettings;
  disabled?: boolean;
  onChange: (next: GameSettings) => void;
};

export default function SettingsPanel({ settings, disabled, onChange }: Props) {
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });

  return (
    <section className="card settings">
      <h2>Règles</h2>

      <div className="rules-duration">
        <div className="rules-label">
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
          onChange={(e) => set({ durationSec: Number(e.target.value) })}
        />
      </div>

      <div className="rules-grid">
        <span>Grille</span>
        <div>
          <div className="chips">
            {DIFFICULTY_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                on={settings.difficulty === option.id}
                disabled={disabled}
                onClick={() => set({ difficulty: option.id })}
              >
                {option.label}
              </Chip>
            ))}
          </div>
          <p className="rules-hint">{difficultyHint(settings.difficulty)}</p>
        </div>

        <span>Lettres</span>
        <div>
          <div className="chips">
            <Chip
              on={settings.letterOrientation !== "shuffle"}
              disabled={disabled}
              onClick={() => set({ letterOrientation: "upright" })}
            >
              À l’endroit
            </Chip>
            <Chip
              on={settings.letterOrientation === "shuffle"}
              disabled={disabled}
              onClick={() => set({ letterOrientation: "shuffle" })}
            >
              Shuffle
            </Chip>
          </div>
          <p className="rules-hint">
            {settings.letterOrientation === "shuffle"
              ? "Comme des dés physiques : chaque lettre est tournée au hasard"
              : "Toutes les lettres restent dans le bon sens"}
          </p>
        </div>

        <span>Minimum</span>
        <div className="chips">
          {[3, 4, 5].map((n) => (
            <Chip
              key={n}
              on={settings.minLetters === n}
              disabled={disabled}
              onClick={() => set({ minLetters: n })}
            >
              {n}
            </Chip>
          ))}
        </div>

        <span>Formes</span>
        <div className="chips">
          <Chip
            on={settings.allowPlurals}
            disabled={disabled}
            onClick={() => set({ allowPlurals: !settings.allowPlurals })}
          >
            Pluriels
          </Chip>
          <Chip
            on={settings.allowFeminines}
            disabled={disabled}
            onClick={() => set({ allowFeminines: !settings.allowFeminines })}
          >
            Féminins
          </Chip>
        </div>

        <span>Verbes</span>
        <div className="chips">
          <Chip
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
          </Chip>
          <Chip
            on={settings.conjugations === "all"}
            disabled={disabled}
            onClick={() => set({ conjugations: "all" })}
          >
            Tous
          </Chip>
          {settings.conjugations === "participles" && (
            <>
              <Chip
                on={settings.allowPastParticiple}
                disabled={disabled}
                onClick={() => {
                  if (settings.allowPastParticiple && !settings.allowPresentParticiple) return;
                  set({ allowPastParticiple: !settings.allowPastParticiple });
                }}
              >
                Passé
              </Chip>
              <Chip
                on={settings.allowPresentParticiple}
                disabled={disabled}
                onClick={() => {
                  if (settings.allowPresentParticiple && !settings.allowPastParticiple) return;
                  set({ allowPresentParticiple: !settings.allowPresentParticiple });
                }}
              >
                Présent
              </Chip>
            </>
          )}
        </div>
      </div>

      <p className="rules-score">Q = Qu · 4 lettres = 1 pt, puis +1 · mot partagé = 0</p>
    </section>
  );
}

function difficultyHint(id: GameSettings["difficulty"]) {
  const { min, max } = DIFFICULTY_BANDS[id];
  if (!Number.isFinite(max)) return `Plus de ${min - 1} mots possibles`;
  return `${min} à ${max} mots possibles`;
}

function Chip({
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
    <button type="button" className={`chip ${on ? "on" : ""}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
