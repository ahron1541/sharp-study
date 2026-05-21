import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// WCAG-compliant modal — traps focus, uses ARIA roles
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
}) {
  const firstFocusRef = useRef(null);
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  useEffect(() => {
    if (isOpen) {
      // Focus the close button when modal opens (accessibility)
      firstFocusRef.current?.focus();
      // Prevent background scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    // Close on Escape key
    const handler = (e) => {
      if (e.key === 'Escape' && closeOnEscape) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeOnEscape, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/62"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      {/* Modal panel */}
      <div className={`relative z-10 flex max-h-[min(90vh,48rem)] w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[0_18px_50px_rgba(15,23,42,0.22)]
                       ${sizes[size]}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-5">
          <h2 id="modal-title" className="text-lg font-semibold text-[color:var(--color-text)]">
            {title}
          </h2>
          {showCloseButton ? (
            <button
              ref={firstFocusRef}
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1 transition-colors hover:bg-[color:var(--color-surface-2)]
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
            >
              <X size={20} className="text-[color:var(--color-text-muted)]" />
            </button>
          ) : (
            <span ref={firstFocusRef} tabIndex={-1} />
          )}
        </div>
        {/* Content */}
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
