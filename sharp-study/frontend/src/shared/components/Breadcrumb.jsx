import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumb({ items }) {
  // items = [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Study Guide' }]
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-[var(--muted)]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
          {item.href ? (
            <Link
              to={item.href}
              className="hover:text-[var(--accent)] transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]
                         rounded"
            >
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-[var(--text-color)] font-medium">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}