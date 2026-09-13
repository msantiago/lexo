import { avatarPreset, isAvatarImage, parseAvatarId } from "@shared/avatars";

type Props = {
  name: string;
  image?: string | null;
  className?: string;
  color?: string;
};

export default function Avatar({ name, image, className = "", color }: Props) {
  const classes = `avatar ${className}`.trim();
  const initial = (name.trim().slice(0, 1) || "?").toUpperCase();

  if (isAvatarImage(image)) {
    return <img className={`${classes} avatar-photo`} src={image ?? ""} alt="" />;
  }

  const id = parseAvatarId(image);
  const preset = avatarPreset(id);
  if (preset) {
    return (
      <span
        className={`${classes} avatar-emoji`}
        style={{ background: color ?? preset.color }}
        aria-hidden
      >
        {preset.emoji}
      </span>
    );
  }

  return (
    <span className={`${classes} account-avatar`} style={color ? { background: color } : undefined}>
      {initial}
    </span>
  );
}
