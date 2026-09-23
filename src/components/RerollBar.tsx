import { useEffect, useState } from "react";
import type { PlayerPublic, RerollView } from "@shared/types";
import ConfirmDialog from "./ConfirmDialog";
import { socket } from "../socket";

type Props = {
  reroll: RerollView;
  players: PlayerPublic[];
  now: number;
  deal: number | null;
};

export default function RerollBar({ reroll, players, now, deal }: Props) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setConfirm(false);
  }, [deal, reroll.solo]);

  const open = reroll.solo || (reroll.windowEndsAt !== null && now < reroll.windowEndsAt);
  if (!reroll.solo && !open) return null;

  const windowLeft =
    reroll.windowEndsAt !== null ? Math.max(0, Math.ceil((reroll.windowEndsAt - now) / 1000)) : null;
  const pending = players.filter((p) => p.connected && !reroll.voterIds.includes(p.id));
  const voted = players.filter((p) => reroll.voterIds.includes(p.id));

  const ask = () => {
    if (reroll.solo) {
      setConfirm(true);
      return;
    }
    socket.emit("game:reroll");
  };

  if (reroll.solo) {
    return (
      <div className="reroll solo">
        <button
          type="button"
          tabIndex={-1}
          className="btn btn-ghost reroll-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={ask}
        >
          Nouveau tirage
        </button>
        {confirm && (
          <ConfirmDialog
            title="Nouveau tirage ?"
            message="La grille est remplacée. Les mots déjà validés sur cette manche restent."
            confirmLabel="Relancer"
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              socket.emit("game:reroll");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`reroll ${reroll.voterIds.length ? "hot" : ""}`}>
      <div className="reroll-copy">
        <strong>
          {reroll.youVoted
            ? "En attente des autres…"
            : reroll.voterIds.length
              ? "Quelqu’un veut relancer"
              : "Tirage trop dur ?"}
        </strong>
        <span>
          {reroll.voterIds.length}/{reroll.needed} d’accord
          {windowLeft !== null ? ` · ${windowLeft}s` : ""}
        </span>
        {voted.length > 0 && (
          <div className="reroll-faces">
            {voted.map((p) => (
              <span key={p.id} className="avatar" style={{ background: p.color }} title={p.name}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {pending.map((p) => (
              <span
                key={p.id}
                className="avatar wait"
                style={{ background: p.color }}
                title={p.name}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
      {!reroll.youVoted && (
        <button
          type="button"
          tabIndex={-1}
          className="btn btn-ivory reroll-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={ask}
        >
          Relancer
        </button>
      )}
    </div>
  );
}
