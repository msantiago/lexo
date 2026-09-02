import { useState } from "react";
import FloatingLetters from "../components/FloatingLetters";
import LexoLogo from "../components/LexoLogo";
import { unlockAudio } from "../lib/sfx";

type Props = {
  name: string;
  onName: (name: string) => void;
  onSolo: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
};

export default function Home({ name, onName, onSolo, onCreate, onJoin }: Props) {
  const [code, setCode] = useState("");
  const ready = name.trim().length > 0;

  return (
    <div className="screen home">
      <FloatingLetters />
      <div className="logo">
        <LexoLogo />
        <p>Les mots sont sur la table</p>
      </div>
      <div className="panel">
        <div className="field">
          <label htmlFor="name">Ton prénom</label>
          <input
            id="name"
            maxLength={16}
            placeholder="Alex"
            value={name}
            onChange={(e) => onName(e.target.value)}
          />
        </div>
        <div className="btn-row">
          <button
            className="btn btn-gold"
            disabled={!ready}
            onClick={() => {
              unlockAudio();
              onSolo();
            }}
          >
            Partie solo
          </button>
          <button
            className="btn btn-ivory"
            disabled={!ready}
            onClick={() => {
              unlockAudio();
              onCreate();
            }}
          >
            Créer un salon
          </button>
          <div className="join-row">
            <input
              className="code-input"
              maxLength={4}
              placeholder="CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            />
            <button
              className="btn btn-ghost"
              disabled={!ready || code.length !== 4}
              onClick={() => {
                unlockAudio();
                onJoin(code);
              }}
            >
              Rejoindre
            </button>
          </div>
        </div>
        <p className="hint">Jusqu’à 10 joueurs · grille 4×4 · chrono en direct</p>
      </div>
      <footer className="credits">Créé par Marc-Antoine Santiago — septembre 2026</footer>
    </div>
  );
}
