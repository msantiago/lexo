import { useEffect } from "react";
import AccountPanel from "../components/AccountPanel";
import { authClient } from "../lib/auth-client";
import { goHome } from "../lib/nav";

export default function Auth({
  mode,
  onDisplayName,
}: {
  mode: "signin" | "signup";
  onDisplayName: (name: string) => void;
}) {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && session?.user) goHome();
  }, [isPending, session?.user]);

  return (
    <div className="auth-page">
      <button className="nav-back" type="button" onClick={goHome}>
        Retour
      </button>
      <h1>{mode === "signup" ? "Créer un compte" : "Connexion"}</h1>
      <p>
        {mode === "signup"
          ? "Un compte suffit pour jouer en solo ou ouvrir un salon."
          : "Reprends tes parties, tes scores et tes badges."}
      </p>
      <AccountPanel initialMode={mode} lead={null} onDisplayName={onDisplayName} />
    </div>
  );
}
