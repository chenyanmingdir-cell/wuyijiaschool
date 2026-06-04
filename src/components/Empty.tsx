interface EmptyProps {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function Empty({ text, actionLabel, onAction }: EmptyProps) {
  return (
    <div className="empty">
      <div>{text}</div>
      {actionLabel && onAction ? (
        <button className="ghost empty-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
