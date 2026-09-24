type Props = {
  className?: string;
};

export default function NewBadge({ className }: Props) {
  return <span className={className ? `new-badge ${className}` : "new-badge"}>New !</span>;
}
