import { matchScore, rankLabel, standingRank } from "@shared/round";
import type { PlayerPublic } from "@shared/types";

type Props = {
  players: PlayerPublic[];
  youId: string;
  showOtherScores?: boolean;
  onToggleOtherScores?: () => void;
};

export default function RoundStandings({
  players,
  youId,
  showOtherScores = true,
  onToggleOtherScores,
}: Props) {
  const you = players.find((player) => player.id === youId) ?? null;
  const others = players
    .filter((player) => player.id !== youId)
    .sort(
      (a, b) =>
        matchScore(b.totalScore, b.roundScore, true) - matchScore(a.totalScore, a.roundScore, true) ||
        a.name.localeCompare(b.name, "fr"),
    );
  const rank = you && showOtherScores ? standingRank(players, you.id) : 0;
  const place = rank === 1 || rank === 2 || rank === 3 ? rank : 0;

  return (
    <div className="round-standings">
      {others.length > 0 && (
        <div className="round-others">
          {others.map((player) => {
            const hidden = !showOtherScores;
            return (
              <span className={`round-other${player.connected ? "" : " offline"}`} key={player.id}>
                <i className="round-dot" style={{ background: player.color }} aria-hidden />
                <span className="round-other-name">{player.name}</span>
                {hidden ? (
                  <span className="round-other-hidden">—</span>
                ) : (
                  <span className="round-score" aria-label={`${player.roundScore} points cette manche`}>
                    {player.roundScore}
                  </span>
                )}
              </span>
            );
          })}
          {onToggleOtherScores && (
            <button
              type="button"
              className={`chip score-visibility ${showOtherScores ? "on" : ""}`}
              onClick={onToggleOtherScores}
              aria-pressed={showOtherScores}
              title={
                showOtherScores
                  ? "Masquer les scores des autres pendant la manche"
                  : "Afficher les scores des autres pendant la manche"
              }
            >
              {showOtherScores ? "Masquer" : "Afficher"}
            </button>
          )}
        </div>
      )}
      {you && (
        <div className="round-you">
          <span className="round-score" aria-label={`${you.roundScore} points cette manche`}>
            {you.roundScore}
          </span>
          {rank > 0 && (
            <sup className="round-rank" aria-label={rankLabel(rank)}>
              {place > 0 ? <Medal place={place} /> : <span>{rankLabel(rank)}</span>}
            </sup>
          )}
        </div>
      )}
    </div>
  );
}

const METAL = {
  1: { disc: "#f6c445", rim: "#e2a61a", ink: "#c4840a" },
  2: { disc: "#d5dde6", rim: "#b4bec8", ink: "#7b8794" },
  3: { disc: "#e2a86e", rim: "#c4844a", ink: "#8d5a32" },
} as const;

function Medal({ place }: { place: 1 | 2 | 3 }) {
  const metal = METAL[place];
  return (
    <svg viewBox="0 0 48 58" aria-hidden>
      <path fill="#ef3d3d" d="M16 30 9 50l8-5 5 11 2-22z" />
      <path fill="#d12525" d="M32 30 39 50l-8-5-5 11-2-22z" />
      <circle cx="24" cy="20" r="16" fill={metal.disc} />
      <circle cx="24" cy="20" r="12.4" fill="none" stroke={metal.rim} strokeWidth="1.6" />
      <text
        x="24"
        y="21.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Fredoka, sans-serif"
        fontSize="16"
        fontWeight="700"
        fill={metal.ink}
      >
        {place}
      </text>
    </svg>
  );
}
