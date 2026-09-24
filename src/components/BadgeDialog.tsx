import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BADGE_CATEGORY_LABELS, type BadgeDef } from "@shared/badges";

export function BadgeButton({
  badge,
  className,
  children,
}: {
  badge: BadgeDef;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && <BadgeDialog badge={badge} onClose={() => setOpen(false)} />}
    </>
  );
}

export default function BadgeDialog({ badge, onClose }: { badge: BadgeDef; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="confirm-backdrop" onMouseDown={onClose}>
      <div
        className="confirm-dialog badge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-confirm-dialog
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="badge-dialog-icon" aria-hidden>
          {badge.icon}
        </div>
        <p className="badge-dialog-cat">{BADGE_CATEGORY_LABELS[badge.category]}</p>
        <h2 id={titleId}>{badge.title}</h2>
        <p>{badge.description}</p>
        <div className="confirm-actions">
          <button ref={closeRef} className="btn btn-gold" type="button" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
