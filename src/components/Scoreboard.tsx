import type { PlayerPublic } from "@shared/types";

type SharedProps = {
  players: PlayerPublic[];
  youId: string;
  showOtherScores?: boolean;
  onToggleOtherScores?: () => void;
};

function hideOtherStats(playerId: string, youId: string, showOtherScores: boolean) {
  return !showOtherScores && playerId !== youId;
}

function VisibilityToggle({
  showOtherScores,
  onToggle,
}: {
  showOtherScores: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`chip score-visibility ${showOtherScores ? "on" : ""}`}
      onClick={onToggle}
      aria-pressed={showOtherScores}
      title={
        showOtherScores
          ? "Masquer les scores des autres pendant la manche"
          : "Afficher les scores des autres pendant la manche"
      }
    >
      {showOtherScores ? "Masquer" : "Afficher"}
    </button>
  );
}

export default function Scoreboard({
  players,
  youId,
  showOtherScores = true,
  onToggleOtherScores,
}: SharedProps) {
  const ranked = showOtherScores
    ? [...players].sort((a, b) => b.roundScore - a.roundScore || b.totalScore - a.totalScore)
    : [...players.filter((p) => p.id === youId), ...players.filter((p) => p.id !== youId)];

  return (
    <aside className="scoreboard">
      <div className="scoreboard-head">
        <h3>Scores</h3>
        {onToggleOtherScores && (
          <VisibilityToggle showOtherScores={showOtherScores} onToggle={onToggleOtherScores} />
        )}
      </div>
      {ranked.map((p) => {
        const hidden = hideOtherStats(p.id, youId, showOtherScores);
        return (
          <div className={`score-row ${p.connected ? "" : "offline"}`} key={p.id}>
            <div className="avatar" style={{ background: p.color }}>
              {p.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="meta">
              <strong>
                {p.name}
                {p.id === youId ? " (toi)" : ""}
              </strong>
              <span>
                {hidden
                  ? p.connected
                    ? "score masqué"
                    : "déconnecté"
                  : `${p.wordCount} mot${p.wordCount > 1 ? "s" : ""}${p.connected ? "" : " · déconnecté"}`}
              </span>
            </div>
            <div className={`pts${hidden ? " hidden" : ""}`}>{hidden ? "—" : p.roundScore}</div>
          </div>
        );
      })}
    </aside>
  );
}

export function ScorePills({
  players,
  youId,
  showOtherScores = true,
  onToggleOtherScores,
}: SharedProps) {
  return (
    <div className="mobile-scores">
      {onToggleOtherScores && (
        <VisibilityToggle showOtherScores={showOtherScores} onToggle={onToggleOtherScores} />
      )}
      {players.map((p) => {
        const hidden = hideOtherStats(p.id, youId, showOtherScores);
        return (
          <div className={`pill ${p.connected ? "" : "offline"}`} key={p.id}>
            <div className="avatar" style={{ background: p.color, width: 28, height: 28, fontSize: 13 }}>
              {p.name.slice(0, 1).toUpperCase()}
            </div>
            <strong>{p.id === youId ? "Toi" : p.name}</strong>
            <span className={hidden ? "hidden" : undefined}>{hidden ? "—" : p.roundScore}</span>
          </div>
        );
      })}
    </div>
  );
}
