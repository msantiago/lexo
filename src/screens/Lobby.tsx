import type { GameSettings, RoomView } from "@shared/types";
import { summarizeRules } from "@shared/rules";
import SettingsPanel from "../components/SettingsPanel";
import LeaveButton from "../components/LeaveButton";
import { unlockAudio } from "../lib/sfx";

type Props = {
  room: RoomView;
  isHost: boolean;
  onSettings: (settings: GameSettings) => void;
  onStart: () => void;
  onLeave: () => void;
};

export default function Lobby({ room, isHost, onSettings, onStart, onLeave }: Props) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="screen lobby">
      <div>
        <div className="room-code">
          <div>
            <div className="muted">Code du salon</div>
            <b>{room.code}</b>
          </div>
          <button className="btn btn-ivory" type="button" onClick={copy}>
            Copier
          </button>
        </div>

        <section className="card" style={{ marginTop: 16 }}>
          <h2>Autour de la table</h2>
          <div className="players">
            {room.players.map((p) => (
              <div className="player-chip" key={p.id}>
                <div className="avatar" style={{ background: p.color }}>
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="meta">
                  <strong>{p.name}</strong>
                  <span>{p.connected ? "en ligne" : "déconnecté"}</span>
                </div>
                {p.id === room.hostId && <span className="host-badge">Hôte</span>}
              </div>
            ))}
          </div>
        </section>

        <div className="btn-row" style={{ marginTop: 16 }}>
          {isHost ? (
            <button
              className="btn btn-gold"
              onClick={() => {
                unlockAudio();
                onStart();
              }}
            >
              {room.players.length === 1 ? "C’est parti !" : `Lancer la manche (${room.players.length})`}
            </button>
          ) : (
            <p className="hint">En attente de l’hôte…</p>
          )}
          <LeaveButton onLeave={onLeave} label="Quitter" />
        </div>
      </div>

      {isHost ? (
        <SettingsPanel settings={room.settings} onChange={onSettings} />
      ) : (
        <section className="card rules-summary">
          <h2>Règles</h2>
          <p>{summarizeRules(room.settings)}</p>
        </section>
      )}
    </div>
  );
}
