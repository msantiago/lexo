import { useEffect, useState, type FormEvent } from "react";
import { authClient, displayNameFromUser } from "../lib/auth-client";
import { goHome } from "../lib/nav";

type Kind = "bug" | "idea";

export default function Contact() {
  const { data: session } = authClient.useSession();
  const [kind, setKind] = useState<Kind>("bug");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const user = session?.user;
    if (!user) return;
    setName((current) => current || displayNameFromUser(user.name, user.email));
    setEmail((current) => current || user.email || "");
  }, [session?.user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, email, message, website }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || "Envoi impossible pour le moment.");
        return;
      }
      setSent(true);
    } catch {
      setError("Envoi impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="panel contact-panel">
      <button className="nav-back" type="button" onClick={goHome}>
        Retour
      </button>
      <h1>Contact</h1>
      <p>Un bouton qui coince, une règle à imaginer, un mot absent du dictionnaire : écris-moi.</p>

      {sent ? (
        <p className="contact-sent">Message envoyé. Merci, je le lis.</p>
      ) : (
        <form className="contact-form" onSubmit={(event) => void submit(event)}>
          <div className="chips" role="radiogroup" aria-label="Sujet">
            <button
              type="button"
              role="radio"
              aria-checked={kind === "bug"}
              className={`chip${kind === "bug" ? " on" : ""}`}
              onClick={() => setKind("bug")}
            >
              Signaler un bug
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === "idea"}
              className={`chip${kind === "idea" ? " on" : ""}`}
              onClick={() => setKind("idea")}
            >
              Proposer une évolution
            </button>
          </div>

          <div className="field">
            <label htmlFor="contact-name">Nom</label>
            <input
              id="contact-name"
              value={name}
              maxLength={40}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">E-mail</label>
            <input
              id="contact-email"
              type="email"
              value={email}
              maxLength={120}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              value={message}
              maxLength={2000}
              rows={6}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </div>
          <div className="contact-honey" aria-hidden="true">
            <label htmlFor="contact-website">Site</label>
            <input
              id="contact-website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          {error && <p className="account-error">{error}</p>}
          <button className="btn btn-gold" type="submit" disabled={busy}>
            Envoyer
          </button>
        </form>
      )}
    </article>
  );
}
