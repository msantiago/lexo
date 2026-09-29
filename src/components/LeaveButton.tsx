import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

type Props = {
  onLeave: () => void;
  label?: string;
  title?: string;
  message: string;
  confirmLabel?: string;
  compact?: boolean;
};

export default function LeaveButton({
  onLeave,
  label = "Quitter",
  title,
  message,
  confirmLabel,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost${compact ? " btn-compact" : ""}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <ConfirmDialog
          title={title ?? `${label} ?`}
          message={message}
          confirmLabel={confirmLabel ?? label}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            onLeave();
          }}
        />
      )}
    </>
  );
}
