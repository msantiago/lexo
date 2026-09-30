import type { ModeStats, ProfilePayload, StatsByMode, UserStats, WordStatsPayload } from "@shared/account";

export type StatsMode = "all" | "solo" | "multi";
type Mode = StatsMode;
type Voice = "self" | "public";

type Tile = { label: string; value: number | string; hint: string };

const MODES: { id: Mode; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "solo", label: "Solo" },
  { id: "multi", label: "À plusieurs" },
];

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function longestTile(longestWord: number, voice: Voice): Tile {
  return {
    label: "Mot le plus long",
    value: longestWord > 0 ? longestWord : "—",
    hint:
      longestWord > 0
        ? `${plural(longestWord, "lettre")} sur un seul mot validé.`
        : voice === "self"
          ? "La longueur de ton plus long mot validé apparaîtra ici."
          : "Longueur du plus long mot validé.",
  };
}

function bestRoundTile(score: number, words: number, voice: Voice): Tile {
  return {
    label: "Meilleure manche",
    value: score,
    hint:
      words > 0
        ? `${score} pts · ${plural(words, "mot")} sur une même grille.`
        : voice === "self"
          ? "Ton meilleur score sur une seule grille."
          : "Meilleur score sur une seule grille.",
  };
}

function allTiles(stats: UserStats, voice: Voice): Tile[] {
  const split = [
    stats.soloGames ? `${stats.soloGames} solo` : null,
    stats.multiGames ? `${stats.multiGames} à plusieurs` : null,
  ].filter(Boolean);
  return [
    {
      label: "Parties",
      value: stats.gamesPlayed,
      hint: split.length > 0 ? `${split.join(" · ")}.` : "Parties terminées en étant connecté.",
    },
    {
      label: "Mots",
      value: stats.wordsFound,
      hint: "Mots validés sur toutes les manches, solo et à plusieurs.",
    },
    { label: "Points", value: stats.totalPoints, hint: "Cumul des scores de toutes les manches." },
    {
      label: "Victoires",
      value: stats.wins,
      hint:
        voice === "self"
          ? "Parties à plusieurs que tu as terminées en tête. Le solo ne compte pas."
          : "Parties à plusieurs terminées en tête.",
    },
    {
      label: "Manches",
      value: stats.roundsPlayed,
      hint: "Grilles jouées jusqu’au bout. Une partie peut contenir plusieurs manches.",
    },
    longestTile(stats.longestWord, voice),
    bestRoundTile(stats.bestRoundScore, stats.bestRoundWords, voice),
    {
      label: "Mots uniques",
      value: stats.uniqueWords,
      hint: "Mots trouvés sans qu’un autre joueur les trouve aussi.",
    },
  ];
}

function soloTiles(stats: ModeStats, voice: Voice): Tile[] {
  return [
    { label: "Parties", value: stats.games, hint: `${plural(stats.rounds, "manche")} en solo.` },
    { label: "Mots", value: stats.words, hint: "Mots validés en solo." },
    { label: "Points", value: stats.points, hint: "Cumul des scores des manches en solo." },
    {
      label: "Moyenne",
      value: formatNumber(stats.averageRoundScore),
      hint: "Points par manche en solo.",
    },
    bestRoundTile(stats.bestRoundScore, stats.bestRoundWords, voice),
    longestTile(stats.longestWord, voice),
  ];
}

function multiTiles(stats: ModeStats, voice: Voice): Tile[] {
  const rate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
  return [
    { label: "Parties", value: stats.games, hint: `${plural(stats.rounds, "manche")} à plusieurs.` },
    {
      label: "Victoires",
      value: stats.wins,
      hint:
        stats.games > 0
          ? `${rate} % des parties terminées en tête, égalités comprises.`
          : "Parties terminées en tête.",
    },
    { label: "Mots", value: stats.words, hint: "Mots validés à plusieurs, mots partagés compris." },
    {
      label: "Mots uniques",
      value: stats.uniqueWords,
      hint:
        voice === "self"
          ? "Mots que tu étais seul à trouver."
          : "Mots trouvés sans qu’un autre joueur les trouve aussi.",
    },
    { label: "Points", value: stats.points, hint: "Cumul des scores des manches à plusieurs." },
    {
      label: "Moyenne",
      value: formatNumber(stats.averageRoundScore),
      hint: "Points par manche à plusieurs.",
    },
    bestRoundTile(stats.bestRoundScore, stats.bestRoundWords, voice),
    longestTile(stats.longestWord, voice),
  ];
}

export function wordStatsFor(profile: ProfilePayload, mode: StatsMode): WordStatsPayload {
  return mode === "all" ? profile.wordStats : profile.wordStatsByMode[mode];
}

export default function ProfileStats({
  stats,
  modes,
  mode,
  onModeChange,
  voice = "self",
}: {
  stats: UserStats;
  modes: StatsByMode;
  mode: StatsMode;
  onModeChange: (mode: StatsMode) => void;
  voice?: Voice;
}) {
  const empty = mode !== "all" && modes[mode].games === 0;
  const tiles =
    mode === "all"
      ? allTiles(stats, voice)
      : mode === "solo"
        ? soloTiles(modes.solo, voice)
        : multiTiles(modes.multi, voice);

  return (
    <div className="profile-stats-block">
      <div className="segment profile-stats-modes" role="radiogroup" aria-label="Type de parties">
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={mode === option.id}
            className={mode === option.id ? "on" : undefined}
            onClick={() => onModeChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {empty ? (
        <p className="hint profile-stats-empty">
          {mode === "solo" ? "Aucune partie solo" : "Aucune partie à plusieurs"} pour l’instant.
        </p>
      ) : (
        <div className="profile-stats">
          {tiles.map((tile) => (
            <div className="profile-stat" key={tile.label}>
              <b>{typeof tile.value === "number" ? formatNumber(tile.value) : tile.value}</b>
              <span>{tile.label}</span>
              <p>{tile.hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
