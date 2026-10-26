type Props = {
  roundScore: number;
  totalScore: number;
  /** Uniquement le score de la partie, quand la manche n’est pas affichée. */
  matchOnly?: boolean;
};

export default function PlayerScore({ roundScore, totalScore, matchOnly }: Props) {
  if (matchOnly) {
    return (
      <span className="score-pair" aria-label={`${totalScore} points sur la partie`}>
        <span className="score-pair-total">{totalScore}</span>
      </span>
    );
  }

  return (
    <span
      className="score-pair"
      title={`Manche ${roundScore} · partie ${totalScore}`}
      aria-label={`plus ${roundScore} cette manche, ${totalScore} sur la partie`}
    >
      <span className="score-pair-round">+{roundScore}</span>
      <span className="score-pair-sep" aria-hidden>
        <svg viewBox="0 0 24 24">
          <path
            d="M4 12h13.5M13 6.5 19.5 12 13 17.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="score-pair-total">{totalScore}</span>
    </span>
  );
}
