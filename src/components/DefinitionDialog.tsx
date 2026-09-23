import { useEffect, useId, useState } from "react";

type Sense = {
  label: string;
  definitions: string[];
};

type Props = {
  word: string;
  onClose: () => void;
};

export default function DefinitionDialog({ word, onClose }: Props) {
  const titleId = useId();
  const [senses, setSenses] = useState<Sense[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    const ctrl = new AbortController();
    setSenses(null);
    setError("");
    fetch(`/api/define/${encodeURIComponent(word)}`, {
      credentials: "include",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return (await res.json()) as { senses?: Sense[] };
      })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setSenses(data.senses ?? []);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("La définition n’a pas pu être chargée.");
      });
    return () => ctrl.abort();
  }, [word]);

  return (
    <div className="confirm-backdrop" onMouseDown={onClose}>
      <div
        className="confirm-dialog define-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-confirm-dialog
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{word}</h2>
        {error ? (
          <p>{error}</p>
        ) : senses === null ? (
          <p className="muted">Recherche de la définition…</p>
        ) : senses.length === 0 ? (
          <p>Aucune définition trouvée.</p>
        ) : (
          <div className="define-senses">
            {senses.map((sense, index) => (
              <section key={`${sense.label}-${index}`} className="define-sense">
                <h3>{sense.label}</h3>
                <ol>
                  {sense.definitions.map((definition, index) => (
                    <li key={index}>{definition}</li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
        <p className="define-source">Wiktionnaire</p>
        <div className="confirm-actions">
          <button className="btn btn-gold" type="button" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
