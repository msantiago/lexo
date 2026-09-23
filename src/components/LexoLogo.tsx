export default function LexoLogo({ compact = false }: { compact?: boolean }) {
  const Tag = compact ? "span" : "h1";
  return (
    <Tag className={compact ? "lexo-logo lexo-logo-compact" : "lexo-logo"} aria-label="Lexo">
      <span className="lexo-letter">L</span>
      <span className="lexo-letter">E</span>
      <span className="lexo-letter x">X</span>
      <span className="lexo-o-tile" aria-hidden="true">
        <svg className="lexo-o-svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" strokeWidth="18" />
        </svg>
      </span>
    </Tag>
  );
}
