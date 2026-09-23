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
  const canStart = isHost && !room.observing;

  return (
    <div className="screen launch">
      <header className="launch-top">
        <ul className="launch-faces">
          {room.players.map((player) => (
            <li className={player.connected ? "" : "offline"} key={player.id}>
              <span className="avatar" style={{ background: player.color }}>
                {player.name.slice(0, 1).toUpperCase()}
              </span>
              <strong>{player.name}</strong>
              {player.id === room.hostId && <span>Hôte</span>}
            </li>
          ))}
        </ul>

        {room.observing ? (
          <p className="hint">Tu observes ce salon. La partie commencera sans toi.</p>
        ) : canStart ? (
          <button
            className="btn btn-gold launch-go"
            onClick={() => {
              unlockAudio();
              onStart();
            }}
          >
            {room.players.length === 1 ? "C’est parti" : `C’est parti · ${room.players.length}`}
          </button>
        ) : (
          <p className="hint">En attente de l’hôte…</p>
        )}
      </header>

      {canStart ? (
        <SettingsPanel settings={room.settings} onChange={onSettings} />
      ) : (
        <p className="launch-summary">{summarizeRules(room.settings)}</p>
      )}

      <div className="launch-links">
        <LeaveButton
          quiet
          onLeave={onLeave}
          label="Quitter"
          title={room.observing ? "Arrêter d’observer ?" : "Quitter le salon ?"}
          message={
            room.observing
              ? "Tu ne verras plus cette partie. Elle continue pour les joueurs."
              : "Tu quittes la table. Les autres peuvent continuer sans toi."
          }
          confirmLabel={room.observing ? "Arrêter" : "Quitter"}
        />
        {admin && onCloseRoom && (
          <LeaveButton
            quiet
            onLeave={onCloseRoom}
            label="Fermer"
            title="Fermer le salon ?"
            message="La partie s’arrête tout de suite, pour toi et pour les autres joueurs."
            confirmLabel="Fermer"
          />
        )}
      </div>
    </div>
  );
}
