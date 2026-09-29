import { useState } from "react";
import type { GameSettings, RoomView } from "@shared/types";
import { summarizeRules } from "@shared/rules";
import Avatar from "../components/Avatar";
import InviteLink from "../components/InviteLink";
import SettingsPanel from "../components/SettingsPanel";
import LeaveButton from "../components/LeaveButton";
import { primeSounds } from "../lib/sfx";

type Props = {
  room: RoomView;
  isHost: boolean;
  onSettings: (settings: GameSettings) => void;
  onStart: () => void;
  onLeave: () => void;
};

export default function Lobby({ room, isHost, onSettings, onStart, onLeave }: Props) {
  const [starting, setStarting] = useState(false);
  const canStart = isHost && !room.observing;

  return (
    <div className="screen launch">
      <header className="launch-top">
        <ul className="launch-faces">
          {room.players.map((player) => (
            <li className={player.connected ? "" : "offline"} key={player.id}>
              <Avatar name={player.name} image={player.image} color={player.color} />
              <strong>{player.name}</strong>
              {player.id === room.hostId && <span>Hôte</span>}
            </li>
          ))}
        </ul>

        {room.observing ? (
          <p className="hint">Tu observes ce salon. La partie commencera sans toi.</p>
        ) : canStart ? (
          <button
            className="btn btn-gold btn-lg launch-go"
            disabled={starting}
            onClick={() => {
              if (starting) return;
              setStarting(true);
              void primeSounds().then(() => onStart());
            }}
          >
            {room.players.length === 1 ? "C’est parti" : `C’est parti · ${room.players.length}`}
          </button>
        ) : (
          <p className="hint">En attente de l’hôte…</p>
        )}
      </header>

      {!room.solo && !room.observing && <InviteLink code={room.code} />}

      {canStart ? (
        <SettingsPanel settings={room.settings} onChange={onSettings} />
      ) : (
        <p className="launch-summary">{summarizeRules(room.settings)}</p>
      )}

      <div className="launch-links">
        <LeaveButton
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
      </div>
    </div>
  );
}
