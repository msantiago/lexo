import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AVATAR_PRESETS,
  LETTER_AVATAR_ID,
  PHOTO_AVATAR_ID,
  customAvatarSrc,
  encodeAvatar,
  parseAvatarId,
} from "@shared/avatars";
import Avatar from "../components/Avatar";
import AvatarCropper from "../components/AvatarCropper";
import { authClient, displayNameFromUser, sanitizePseudo } from "../lib/auth-client";
import { loadImageFile } from "../lib/crop-avatar";

type Props = {
  onDisplayName: (name: string) => void;
};

export default function Preferences({ onDisplayName }: Props) {
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [nick, setNick] = useState("");
  const [nickBusy, setNickBusy] = useState(false);
  const [nickSaved, setNickSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const label = displayNameFromUser(session?.user?.name, session?.user?.email);
  const avatarId = parseAvatarId(session?.user?.image);
  const userId = session?.user?.id;
  const photoSrc =
    avatarId === PHOTO_AVATAR_ID && session?.user?.image
      ? session.user.image
      : userId
        ? customAvatarSrc(userId)
        : null;

  useEffect(() => {
    setNick(label);
  }, [label]);

  useEffect(() => {
    if (avatarId === PHOTO_AVATAR_ID) setHasPhoto(true);
  }, [avatarId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/profile", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ hasCustomAvatar?: boolean }>;
      })
      .then((data) => {
        if (!cancelled && data?.hasCustomAvatar) setHasPhoto(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const saveAvatar = async (id: string) => {
    if (id === avatarId || avatarBusy) return;
    setError(null);
    setAvatarBusy(true);
    try {
      const image =
        id === PHOTO_AVATAR_ID && userId ? customAvatarSrc(userId, Date.now()) : encodeAvatar(id);
      const result = await authClient.updateUser({ image });
      if (result.error) setError("Impossible d’enregistrer l’avatar.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickPhoto = () => fileRef.current?.click();

  const onPhotoFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      setCropImage(await loadImageFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire cette image.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmPhoto = async (dataUrl: string) => {
    setError(null);
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const payload = (await res.json().catch(() => null)) as { image?: string; error?: string } | null;
      if (!res.ok || !payload?.image) {
        setError(payload?.error || "Impossible d’enregistrer la photo.");
        return;
      }
      const result = await authClient.updateUser({ image: payload.image });
      if (result.error) {
        setError("La photo est enregistrée, mais le profil n’a pas été mis à jour.");
        return;
      }
      setHasPhoto(true);
      setCropImage(null);
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveNick = async (event: FormEvent) => {
    event.preventDefault();
    const next = sanitizePseudo(nick);
    if (!next) {
      setError("Choisis un pseudo (16 caractères max.).");
      return;
    }
    setError(null);
    setNickBusy(true);
    setNickSaved(false);
    try {
      const result = await authClient.updateUser({ name: next });
      if (result.error) {
        setError("Impossible d’enregistrer le pseudo.");
        return;
      }
      setNick(next);
      onDisplayName(next);
      setNickSaved(true);
      window.setTimeout(() => setNickSaved(false), 2200);
    } finally {
      setNickBusy(false);
    }
  };

  return (
    <div className="profile">
      <section className="panel profile-hero" aria-label="Préférences">
        <div className="profile-head">
          <div className="profile-identity">
            <div className="meta">
              <h1>Préférences</h1>
              <span>Avatar, pseudo et réglages du compte</span>
            </div>
          </div>
        </div>

        <fieldset className="avatar-picker" disabled={avatarBusy}>
          <legend>Avatar</legend>
          <input
            ref={fileRef}
            className="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            aria-label="Importer une image"
            onChange={(e) => void onPhotoFile(e.target.files?.[0])}
          />
          <div className="avatar-options" role="listbox" aria-label="Choisir un avatar">
            {hasPhoto && photoSrc ? (
              <button
                type="button"
                role="option"
                aria-selected={avatarId === PHOTO_AVATAR_ID}
                className={`avatar-option ${avatarId === PHOTO_AVATAR_ID ? "on" : ""}`}
                title="Photo"
                aria-label="Photo"
                onClick={() => saveAvatar(PHOTO_AVATAR_ID)}
              >
                <Avatar name={label} image={photoSrc} />
              </button>
            ) : (
              <button
                type="button"
                className="avatar-option avatar-option-add"
                title="Importer une image"
                aria-label="Importer une image"
                onClick={pickPhoto}
              >
                <span className="avatar avatar-add" aria-hidden>
                  +
                </span>
              </button>
            )}
            <button
              type="button"
              role="option"
              aria-selected={avatarId === LETTER_AVATAR_ID}
              className={`avatar-option ${avatarId === LETTER_AVATAR_ID ? "on" : ""}`}
              title="Initiale"
              aria-label="Initiale"
              onClick={() => saveAvatar(LETTER_AVATAR_ID)}
            >
              <Avatar name={label} image={encodeAvatar(LETTER_AVATAR_ID)} />
            </button>
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={avatarId === preset.id}
                className={`avatar-option ${avatarId === preset.id ? "on" : ""}`}
                title={preset.label}
                aria-label={preset.label}
                onClick={() => saveAvatar(preset.id)}
              >
                <Avatar name={label} image={encodeAvatar(preset.id)} />
              </button>
            ))}
          </div>
          <button className="btn btn-ghost avatar-import" type="button" onClick={pickPhoto}>
            {hasPhoto ? "Changer la photo" : "Importer une image"}
          </button>
        </fieldset>

        {cropImage && (
          <AvatarCropper
            image={cropImage}
            busy={avatarBusy}
            onCancel={() => setCropImage(null)}
            onConfirm={(dataUrl) => void confirmPhoto(dataUrl)}
          />
        )}

        <form className="profile-nick" onSubmit={saveNick}>
          <div className="field">
            <label htmlFor="prefs-nick">Pseudo</label>
            <input
              id="prefs-nick"
              maxLength={16}
              value={nick}
              autoComplete="nickname"
              onChange={(e) => {
                setNick(e.target.value);
                setNickSaved(false);
              }}
            />
          </div>
          <button
            className="btn btn-ivory"
            type="submit"
            disabled={nickBusy || sanitizePseudo(nick) === label || !sanitizePseudo(nick)}
          >
            {nickBusy ? "Enregistrement…" : nickSaved ? "Enregistré" : "Enregistrer"}
          </button>
        </form>

        {error && <p className="account-error">{error}</p>}
      </section>
    </div>
  );
}
