import { ChevronDown, BookOpen } from 'lucide-react';
import { useState } from 'react';

export default function StudyGuideSidebar({
  sections = [],
  onJumpToSection,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-3rem)]">
      <nav className="flex h-full flex-col rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[color:var(--color-accent)]" />
            <h2 className="text-sm font-black uppercase tracking-[0.25em] text-[color:var(--color-text)]">
              Contents
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand contents' : 'Collapse contents'}
            className="flex items-center gap-1 rounded-full bg-[color:var(--color-surface-2)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-border)]"
          >
            {collapsed ? 'Open' : 'Close'}
            <ChevronDown size={14} className={`transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`} />
          </button>
        </div>

        {!collapsed ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <p className="mb-3 text-xs leading-5 text-[color:var(--color-text-muted)]">
              Jump to headings and subheadings in this guide.
            </p>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {sections.length ? sections.map((section, index) => {
                const levelOffset = Math.max(0, Math.min(3, (section.level || 2) - 2));
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onJumpToSection(section.id)}
                    className="group flex w-full items-start gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
                    style={{ marginLeft: `${levelOffset * 12}px` }}
                  >
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-xs font-black text-[color:var(--color-accent)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-[color:var(--color-text)] group-hover:text-[color:var(--color-accent)]">
                          {section.title}
                        </h3>
                        <span className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                          H{section.level || 2}
                        </span>
                      </div>
                      {section.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--color-text-muted)]">
                          {section.summary}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-text-muted)]">
                  No headings yet. Add `H2` or `H3` sections to build the navigator.
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mt-4 flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] px-4 py-6 text-sm font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)]"
          >
            Open contents
          </button>
        )}
      </nav>
    </aside>
  );
}
