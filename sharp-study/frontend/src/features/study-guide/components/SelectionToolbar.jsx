export default function SelectionToolbar({
  position,
  visible,
  selectedText,
  onHighlight,
  onEdit,
  onClose,
}) {
  if (!visible || !position) return null;

  return (
    <div
      className="fixed z-50"
      style={{
        top: `${Math.max(16, position.top)}px`,
        left: `${Math.max(16, position.left)}px`,
      }}
    >
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur">
        <span className="max-w-[220px] truncate text-xs font-semibold text-[color:var(--color-text-muted)]">
          {selectedText}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-border)]"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onHighlight}
          className="rounded-full bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-accent-text)] transition hover:opacity-90"
        >
          Highlight
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close selection toolbar"
          className="rounded-full px-2 py-1 text-xs font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
