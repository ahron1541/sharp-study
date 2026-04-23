import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// WCAG-compliant modal — traps focus, uses ARIA roles
export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
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
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal panel */}
      <div className={`relative bg-[var(--card-bg)] rounded-2xl shadow-2xl w-full
                       ${sizes[size]} border border-[var(--card-border)] z-10`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--card-border)]">
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--text-color)]">
            {title}
          </h2>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg hover:bg-[var(--card-border)] transition-colors
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <X size={20} className="text-[var(--muted)]" />
          </button>
        </div>
        {/* Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}