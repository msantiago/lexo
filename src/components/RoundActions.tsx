type WatchProps = {
  onClick: () => void;
};

type JoinProps = {
  onClick: () => void;
  disabled?: boolean;
  label: string;
};

export function WatchButton({ onClick }: WatchProps) {
  return (
    <button type="button" className="icon-btn" aria-label="Regarder" title="Regarder" onClick={onClick}>
      <EyeIcon />
    </button>
  );
}

export function JoinButton({ onClick, disabled, label }: JoinProps) {
  return (
    <button
      type="button"
      className="icon-btn primary"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {label === "Revenir" ? <ReturnIcon /> : <JoinIcon />}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M2.5 12S6.5 6.5 12 6.5 21.5 12 21.5 12 17.5 17.5 12 17.5 2.5 12 2.5 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function JoinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="8" r="2.3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4.5 18c.6-2.5 2.4-3.8 4.5-3.8s3.9 1.3 4.5 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M17 9.5v5.5M14.25 12.25h5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11.5h8.5a5 5 0 0 1 0 10H12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
