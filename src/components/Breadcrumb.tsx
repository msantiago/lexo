export type Crumb = {
  label: string;
  onClick?: () => void;
};

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav className="crumbs" aria-label="Fil d’Ariane">
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {index > 0 && (
                <span className="crumbs-sep" aria-hidden="true">
                  /
                </span>
              )}
              {current || !item.onClick ? (
                <span aria-current={current ? "page" : undefined}>{item.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
