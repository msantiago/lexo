import type { GameSettings, RoomView } from "@shared/types";
import { summarizeRules } from "@shared/rules";
import SettingsPanel from "../components/SettingsPanel";
import LeaveButton from "../components/LeaveButton";
import { unlockAudio } from "../lib/sfx";

type Props = {
  room: RoomView;
  isHost: boolean;
  admin?: boolean;
  onSettings: (settings: GameSettings) => void;
  onStart: () => void;
  onLeave: () => void;
  onCloseRoom?: () => void;
};

export default function Lobby({ room, isHost, admin, onSettings, onStart, onLeave, onCloseRoom }: Props) {
  return (
    <div className="screen lobby">
      <div>
        <section className="card">
          {room.observing && <p className="observe-badge">Observateur</p>}
          <h2>{room.observing ? "Salon observé" : "Autour de la table"}</h2>
          <div className="players">
            {room.players.map((p) => (
              <div className={`player-chip ${p.connected ? "" : "offline"}`} key={p.id}>
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
          {room.observing ? (
            <p className="hint">Tu observes ce salon — la partie commencera sans toi.</p>
          ) : isHost ? (
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
          <LeaveButton
            onLeave={onLeave}
            label="Quitter"
            confirmLabel={room.observing ? "Arrêter d’observer ?" : undefined}
          />
          {admin && onCloseRoom && (
            <LeaveButton
              onLeave={onCloseRoom}
              label="Fermer le salon"
              confirmLabel="Confirmer : fermer ?"
            />
          )}
        </div>
      </div>

      {isHost && !room.observing ? (
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
