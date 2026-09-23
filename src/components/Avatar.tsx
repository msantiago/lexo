import { avatarPreset, isAvatarImage, parseAvatarId } from "@shared/avatars";

type Props = {
  name: string;
  image?: string | null;
  className?: string;
  color?: string;
  online?: boolean;
};

export default function Avatar({ name, image, className = "", color, online = false }: Props) {
  const classes = `avatar ${className}`.trim();
  const initial = (name.trim().slice(0, 1) || "?").toUpperCase();

  let face;
  if (isAvatarImage(image)) {
    face = <img className={`${classes} avatar-photo`} src={image ?? ""} alt="" />;
  } else {
    const preset = avatarPreset(parseAvatarId(image));
    face = preset ? (
      <span
        className={`${classes} avatar-emoji`}
        style={{ background: color ?? preset.color }}
        aria-hidden
      >
        {preset.emoji}
      </span>
    ) : (
      <span className={`${classes} account-avatar`} style={color ? { background: color } : undefined}>
        {initial}
      </span>
    );
  }

  if (!online) return face;

  return (
    <span className="avatar-online">
      {face}
      <span className="presence-badge" role="img" aria-label="En ligne" />
    </span>
  );
}
