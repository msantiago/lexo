import { useEffect, useState, type FormEvent } from "react";
import type { AuthProviders } from "@shared/account";
import {
  SOCIAL_PROVIDERS,
  authClient,
  authErrorMessage,
  displayNameFromUser,
  refreshSocketAuth,
  sanitizePseudo,
} from "../lib/auth-client";

type Mode = "signin" | "signup";

const EMPTY_PROVIDERS: AuthProviders = {
  google: false,
  apple: false,
  facebook: false,
  microsoft: false,
  github: false,
  discord: false,
};

type Props = {
  admin?: boolean;
  onDisplayName: (name: string) => void;
  onOpenProfile?: () => void;
};

export default function AccountPanel({ admin, onDisplayName, onOpenProfile }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders>(EMPTY_PROVIDERS);

  useEffect(() => {
    fetch("/api/auth-config")
      .then((res) => res.json())
      .then((data: AuthProviders) => setProviders({ ...EMPTY_PROVIDERS, ...data }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    onDisplayName(displayNameFromUser(session.user.name, session.user.email));
  }, [session?.user.id, session?.user.name, session?.user.email, onDisplayName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: sanitizePseudo(name) || "Joueur",
        });
        if (result.error) setError(authErrorMessage(result.error));
        else refreshSocketAuth();
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe,
        });
        if (result.error) setError(authErrorMessage(result.error));
        else refreshSocketAuth();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: keyof AuthProviders) => {
    setError(null);
    setBusy(true);
    try {
      await authClient.signIn.social({ provider, callbackURL: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion sociale impossible.");
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    await authClient.signOut();
    refreshSocketAuth();
    setBusy(false);
  };

  if (isPending) {
    return (
      <section className="panel account-panel">
        <p className="hint">Chargement du compte…</p>
      </section>
    );
  }

  if (session?.user) {
    const label = displayNameFromUser(session.user.name, session.user.email);
    return (
      <section className="panel account-panel">
        <div className="account-user">
          <span className="avatar account-avatar">{label.slice(0, 1).toUpperCase()}</span>
          <div className="meta">
            <strong>
              {label}
              {admin ? <span className="admin-badge">Admin</span> : null}
            </strong>
            <span>{session.user.email}</span>
          </div>
        </div>
        <div className="account-actions">
          {onOpenProfile && (
            <button className="btn btn-ivory" type="button" onClick={onOpenProfile}>
              Profil, badges & parties
            </button>
          )}
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={signOut}>
            Déconnexion
          </button>
        </div>
      </section>
    );
  }

  const enabledSocial = SOCIAL_PROVIDERS.filter((item) => providers[item.id]);

  return (
    <section className="panel account-panel">
      <div className="account-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`chip ${mode === "signin" ? "on" : ""}`}
          aria-selected={mode === "signin"}
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
        >
          Connexion
        </button>
        <button
          type="button"
          role="tab"
          className={`chip ${mode === "signup" ? "on" : ""}`}
          aria-selected={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
        >
          Créer un compte
        </button>
      </div>

      <form className="account-form" onSubmit={submit}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="account-name">Pseudo</label>
            <input
              id="account-name"
              maxLength={16}
              placeholder="Alex"
              value={name}
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="account-email">E-mail</label>
          <input
            id="account-email"
            type="email"
            placeholder="alex@email.com"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="account-password">Mot de passe</label>
          <input
            id="account-password"
            type="password"
            minLength={8}
            placeholder="8 caractères min."
            value={password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <label className="remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Se souvenir de moi
        </label>
        {error && <p className="account-error">{error}</p>}
        <button className="btn btn-gold" type="submit" disabled={busy}>
          {mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>

      {enabledSocial.length > 0 && (
        <div className="account-social">
          <p className="account-or">ou</p>
          {enabledSocial.map((item) => (
            <button
              key={item.id}
              className="btn btn-ivory"
              type="button"
              disabled={busy}
              onClick={() => social(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
