import { useState } from 'react';

export default function SelectionToolbar({
  position,
  visible,
  selectedText,
  onHighlight,
  highlightColors = [],
  onEdit,
  onRemoveHighlight,
  onClose,
}) {
  const [highlightOpen, setHighlightOpen] = useState(false);

  if (!visible || !position) return null;

  return (
    <div
      className="fixed z-50"
      style={{
        top: `${Math.max(16, position.top)}px`,
        left: `${Math.max(16, position.left)}px`,
      }}
    >
      <div className="relative flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur">
        <span className="hidden max-w-[180px] truncate text-xs font-semibold text-[color:var(--color-text-muted)] sm:block">
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
          onClick={() => setHighlightOpen((value) => !value)}
          className="rounded-full bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-accent-text)] transition hover:opacity-90"
          aria-expanded={highlightOpen}
          aria-controls="selection-highlight-colors"
        >
          Highlight
        </button>
        {highlightOpen && highlightColors.length > 0 && (
          <div
            id="selection-highlight-colors"
            className="absolute left-1/2 top-[calc(100%+0.5rem)] flex -translate-x-1/2 items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1 shadow-xl shadow-black/20"
          >
            {highlightColors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => onHighlight(color.value)}
                className="h-7 w-7 rounded-full border border-black/10 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
                aria-label={`Highlight selected text with ${color.name}`}
                title={`Highlight selected text with ${color.name}`}
                style={{ backgroundColor: color.swatch || color.value }}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onRemoveHighlight}
          aria-label="Remove highlight from selected text"
          title="Remove highlight from selected text"
          className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-border)]"
        >
          Remove
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
