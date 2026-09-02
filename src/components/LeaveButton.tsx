import { useEffect, useState } from "react";

type Props = {
  onLeave: () => void;
  label?: string;
  confirmLabel?: string;
  compact?: boolean;
};

export default function LeaveButton({
  onLeave,
  label = "Quitter la table",
  confirmLabel = "Confirmer : quitter ?",
  compact = false,
}: Props) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(false), 3500);
    return () => window.clearTimeout(t);
  }, [confirm]);

  return (
    <button
      type="button"
      className={`btn ${confirm ? "btn-coral" : "btn-ghost"}${compact ? " btn-compact" : ""}`}
      onClick={() => {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        onLeave();
      }}
    >
      {confirm ? confirmLabel : label}
    </button>
  );
}
