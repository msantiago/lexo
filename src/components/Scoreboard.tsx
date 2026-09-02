import type { PlayerPublic } from "@shared/types";

export default function Scoreboard({
  players,
  youId,
}: {
  players: PlayerPublic[];
  youId: string;
}) {
  const ranked = [...players].sort(
    (a, b) => b.roundScore - a.roundScore || b.totalScore - a.totalScore,
  );
  return (
    <aside className="scoreboard">
      <h3>Scores</h3>
      {ranked.map((p) => (
        <div className="score-row" key={p.id}>
          <div className="avatar" style={{ background: p.color }}>
            {p.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="meta">
            <strong>
              {p.name}
              {p.id === youId ? " (toi)" : ""}
            </strong>
            <span>{p.wordCount} mot{p.wordCount > 1 ? "s" : ""}</span>
          </div>
          <div className="pts">{p.roundScore}</div>
        </div>
      ))}
    </aside>
  );
}

export function ScorePills({
  players,
  youId,
}: {
  players: PlayerPublic[];
  youId: string;
}) {
  return (
    <div className="mobile-scores">
      {players.map((p) => (
        <div className="pill" key={p.id}>
          <div className="avatar" style={{ background: p.color, width: 28, height: 28, fontSize: 13 }}>
            {p.name.slice(0, 1).toUpperCase()}
          </div>
          <strong>{p.id === youId ? "Toi" : p.name}</strong>
          <span>{p.roundScore}</span>
        </div>
      ))}
    </div>
  );
}
