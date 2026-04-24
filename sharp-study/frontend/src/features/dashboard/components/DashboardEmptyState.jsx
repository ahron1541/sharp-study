import { Plus, FileText } from 'lucide-react';

/**
 * Empty state shown when a material category has no items.
 *
 * Props:
 *   icon     — Lucide icon component
 *   heading  — primary message
 *   body     — secondary message
 *   cta      — { label, onClick }
 */
export default function DashboardEmptyState({ icon: Icon, heading, body, cta }) {
  return (
    <div
      className="
        flex flex-col items-center justify-center text-center
        py-14 px-6 bg-surface rounded-2xl shadow-card
      "
      role="status"
      aria-label={heading}
    >
      <div
        className="
          w-14 h-14 rounded-full bg-surface-2
          flex items-center justify-center mb-4
        "
        aria-hidden="true"
      >
        {Icon && <Icon size={24} className="text-muted" />}
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{heading}</h3>
      <p className="text-sm text-muted mb-6 max-w-xs leading-relaxed">{body}</p>
      {cta && (
        <button
          onClick={cta.onClick}
          className="
            inline-flex items-center gap-2 px-4 py-2
            bg-accent text-accent-text text-sm font-semibold
            rounded-pill hover:bg-accent-hover
            transition-colors focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2
          "
        >
          <Plus size={16} aria-hidden="true" />
          {cta.label}
        </button>
      )}
    </div>
  );
}