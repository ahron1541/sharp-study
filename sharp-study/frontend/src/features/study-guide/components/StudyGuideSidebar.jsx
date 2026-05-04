import { ChevronDown, BookOpen } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function StudyGuideSidebar({
  sections = [],
  onJumpToSection,
}) {
  const [openIds, setOpenIds] = useState(() => new Set());
  const [hasInteracted, setHasInteracted] = useState(false);

  const defaultIds = useMemo(
    () => new Set(sections.slice(0, 2).map((section) => section.id)),
    [sections]
  );

  const effectiveOpenIds = hasInteracted ? openIds : defaultIds;

  const toggle = (sectionId) => {
    setHasInteracted(true);
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] pb-3">
          <BookOpen size={16} className="text-[color:var(--color-accent)]" />
          <h2 className="text-sm font-black uppercase tracking-[0.25em] text-[color:var(--color-text)]">
            Contents
          </h2>
        </div>

        <p className="mt-3 text-xs leading-5 text-[color:var(--color-text-muted)]">
          Jump to any heading or subheading. Expand a section to see its short summary.
        </p>

        <div className="mt-4 space-y-3">
          {sections.length ? sections.map((section) => {
            const isOpen = effectiveOpenIds.has(section.id);

            return (
              <div key={section.id} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[color:var(--color-text)]">{section.title}</p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-[color:var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[color:var(--color-border)] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onJumpToSection(section.id)}
                      className="text-xs font-bold text-[color:var(--color-accent)] hover:underline"
                    >
                      Jump to section
                    </button>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-text-muted)]">
              No headings yet. Add sections with `H2` or `H3`.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
