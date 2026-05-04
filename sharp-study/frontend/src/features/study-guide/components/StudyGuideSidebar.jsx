import { ChevronDown, ChevronRight, BookOpen, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function StudyGuideSidebar({
  sections = [],
  quickReferenceGroups = [],
  activeTab = 'outline',
  onTabChange,
  onJumpToSection,
}) {
  const [openSectionIds, setOpenSectionIds] = useState(() => new Set());
  const [hasInteracted, setHasInteracted] = useState(false);
  const defaultOpenIds = useMemo(
    () => new Set(sections.slice(0, 2).map((section) => section.id)),
    [sections]
  );
  const effectiveOpenIds = hasInteracted ? openSectionIds : defaultOpenIds;

  const tabs = useMemo(() => ([
    { id: 'outline', label: 'Outline', icon: BookOpen },
    { id: 'reference', label: 'Quick reference', icon: Sparkles },
  ]), []);

  const toggleSection = (sectionId) => {
    setHasInteracted(true);
    setOpenSectionIds((current) => {
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
        <div className="flex items-center gap-2 rounded-full bg-[color:var(--color-surface-2)] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition ${
                  active
                    ? 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-sm'
                    : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'outline' ? (
          <div className="mt-4 space-y-3">
            {sections.length ? sections.map((section) => {
              const isOpen = effectiveOpenIds.has(section.id);
              return (
                <div key={section.id} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[color:var(--color-text)]">{section.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--color-text-muted)]">
                        {section.summary || 'Tap to expand this section.'}
                      </p>
                    </div>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
                      {section.snippets?.length ? (
                        <ul className="mt-3 space-y-2">
                          {section.snippets.slice(0, 3).map((snippet, index) => (
                            <li key={`${section.id}-${index}`} className="rounded-xl bg-[color:var(--color-surface)] px-3 py-2 text-xs leading-5 text-[color:var(--color-text)]">
                              {snippet}
                            </li>
                          ))}
                        </ul>
                      ) : null}
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
        ) : (
          <div className="mt-4 space-y-4">
            {quickReferenceGroups.map((group) => (
              <div key={group.id} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
                <h3 className="text-sm font-extrabold text-[color:var(--color-text)]">{group.label}</h3>
                <div className="mt-3 space-y-2">
                  {group.items.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onJumpToSection(item.id)}
                      className="block w-full rounded-xl bg-[color:var(--color-surface)] px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <p className="text-xs font-bold text-[color:var(--color-text)]">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--color-text-muted)]">{item.detail}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
