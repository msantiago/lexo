function slug(word: string): string {
  return word.trim().toLowerCase();
}

const DICTS = [
  {
    id: "larousse",
    label: "Larousse",
    href: (word: string) =>
      `https://www.larousse.fr/dictionnaires/francais/${encodeURIComponent(slug(word))}`,
  },
  {
    id: "robert",
    label: "Robert",
    href: (word: string) =>
      `https://dictionnaire.lerobert.com/definition/${encodeURIComponent(slug(word))}`,
  },
  {
    id: "wiki",
    label: "Wiki",
    title: "Wiktionnaire",
    href: (word: string) =>
      `https://fr.wiktionary.org/wiki/${encodeURIComponent(slug(word))}`,
  },
] as const;

export default function WordLink({ word }: { word: string }) {
  return (
    <span className="word-with-dicts">
      <span className="word-label">{word}</span>
      <span className="dict-links" aria-label={`Dictionnaires pour ${word}`}>
        {DICTS.map((dict) => (
          <a
            key={dict.id}
            className="dict-chip"
            href={dict.href(word)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${"title" in dict ? dict.title : dict.label} : ${word}`}
            onClick={(e) => e.stopPropagation()}
          >
            {dict.label}
          </a>
        ))}
      </span>
    </span>
  );
}
