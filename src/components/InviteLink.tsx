import { useEffect, useRef, useState } from "react";
import { inviteUrl } from "../lib/invite";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

export default function InviteLink({ code }: { code: string }) {
  const url = inviteUrl(code);
  const [status, setStatus] = useState<"idle" | "copied" | "select">("idle");
  const timer = useRef<number | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyText(url);
    if (!ok) {
      field.current?.focus();
      field.current?.select();
    }
    setStatus(ok ? "copied" : "select");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 2600);
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Lexo", text: "Rejoins ma partie de Lexo !", url });
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") void copy();
    }
  };

  return (
    <section className="invite-link" aria-label="Inviter des joueurs">
      <p className="invite-link-label">Invite tes amis avec ce lien</p>
      <div className="invite-link-row">
        <input
          ref={field}
          className="invite-link-url"
          value={url}
          readOnly
          aria-label="Lien d’invitation"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="btn btn-ghost" onClick={() => void copy()}>
          {status === "copied" ? "Lien copié" : status === "select" ? "Lien sélectionné" : "Copier le lien"}
        </button>
        {canShare && (
          <button type="button" className="btn btn-ivory" onClick={() => void share()}>
            Partager
          </button>
        )}
      </div>
    </section>
  );
}
