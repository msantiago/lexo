import { version } from "../../package.json";
import { CREDITS_PATH, PRIVACY_PATH, TERMS_PATH } from "../lib/nav";

export default function CreditsFooter() {
  return (
    <footer className="credits">
      <p>
        Créé par Marc-Antoine Santiago — septembre 2026 - v{version}
      </p>
      <nav className="legal-links">
        <a href={CREDITS_PATH}>Crédits</a>
        <a href={PRIVACY_PATH}>Confidentialité</a>
        <a href={TERMS_PATH}>Conditions d’utilisation</a>
      </nav>
    </footer>
  );
}
