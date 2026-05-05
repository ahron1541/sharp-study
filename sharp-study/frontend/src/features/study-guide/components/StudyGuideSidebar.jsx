import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StudyGuideSidebar({
  sections = [],
  onJumpToSection,
  activeSectionId,
  collapsed = false,
  onToggleCollapse,
}) {
  return (
    <aside
      className={`study-guide-sidebar lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-2.5rem)] ${
        collapsed ? 'lg:w-[92px]' : 'lg:w-[296px]'
      }`}
    >
      <nav className="flex h-full flex-col rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/96 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.1)] transition-[width,transform,box-shadow] duration-300">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] pb-3">
          <div className={`flex min-w-0 items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-surface-2)] text-[color:var(--color-accent)]">
              <BookOpen size={18} />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-[color:var(--color-text)]">
                  Contents
                </h2>
                <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                  Follow the lesson headings
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand contents sidebar' : 'Collapse contents sidebar'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] transition hover:-translate-y-0.5 hover:shadow-sm"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!collapsed ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <p className="mb-4 text-sm leading-6 text-[color:var(--color-text-muted)]">
              Jump through the study guide while you scroll.
            </p>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {sections.length ? sections.map((section) => {
                const levelOffset = Math.max(0, Math.min(3, (section.level || 2) - 2));
                const isActive = activeSectionId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onJumpToSection(section.id)}
                    className={`group flex w-full items-start gap-3 rounded-[1.35rem] border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] ${
                      isActive
                        ? 'border-[color:var(--color-accent)] bg-[color:var(--color-surface-2)] shadow-[0_12px_24px_rgba(15,23,42,0.12)]'
                        : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/72 hover:-translate-y-0.5 hover:bg-[color:var(--color-surface-2)] hover:shadow-sm'
                    }`}
                    style={{ marginLeft: `${levelOffset * 10}px` }}
                  >
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${isActive ? 'bg-[color:var(--color-accent)]' : 'bg-[color:var(--color-text-muted)]/35 group-hover:bg-[color:var(--color-accent)]'}`} />
                    <div className="min-w-0">
                      <h3 className={`truncate text-sm font-bold ${isActive ? 'text-[color:var(--color-text)]' : 'text-[color:var(--color-text)]'}`}>
                        {section.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--color-text-muted)]">
                        {section.summary}
                      </p>
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-text-muted)]">
                  No headings yet. Add `H2` or `H3` sections to build the navigator.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-1 flex-col items-center justify-start gap-3">
            <div className="rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] px-3 py-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] [writing-mode:vertical-rl] [text-orientation:mixed]">
              Contents
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {sections.slice(0, 8).map((section) => {
                const isActive = activeSectionId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onJumpToSection(section.id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                      isActive
                        ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/12 text-[color:var(--color-accent)]'
                        : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]/85'
                    }`}
                    aria-label={`Jump to ${section.title}`}
                    title={section.title}
                  >
                    <span className="text-xs font-black">{Math.min(section.level || 2, 9)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
