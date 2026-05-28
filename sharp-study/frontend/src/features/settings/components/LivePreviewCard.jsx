import React from 'react';
import { ATMOSPHERE_PRESETS, getFontSizePreset } from '../../theme/constants/themes';
import { Bell, BookOpen, Home, Layers, Menu, User } from 'lucide-react';

const FONT_PREVIEW = {
  'dm-sans': '"DM Sans", ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  monospace: '"Courier New", ui-monospace, monospace',
};

export default function LivePreviewCard({ draft, showHeading = true }) {
  const preset = ATMOSPHERE_PRESETS.find((item) => item.id === draft.atmosphere) || ATMOSPHERE_PRESETS[0];
  const isDark = draft.display_mode === 'dark';
  const fontPreset = getFontSizePreset(draft.font_size_preset);
  const previewReaderFontSize = `${Math.max(12, fontPreset.fontSize * 0.74).toFixed(2)}px`;

  const previewStyle = {
    '--preview-bg': isDark ? '#020617' : '#F8FAFC',
    '--preview-surface': isDark ? '#0F172A' : '#FFFFFF',
    '--preview-surface-2': isDark ? '#1E293B' : '#F1F5F9',
    '--preview-text': isDark ? '#F8FAFC' : '#0F172A',
    '--preview-muted': isDark ? '#94A3B8' : '#64748B',
    '--preview-border': isDark ? '#334155' : '#E2E8F0',
    '--preview-reader-size': fontPreset.readerFontSize,
    '--preview-learning-size': fontPreset.learningFontSize,
    '--preview-line-height': fontPreset.lineHeight,
    fontFamily: FONT_PREVIEW[draft.font_family] || FONT_PREVIEW['dm-sans'],
    lineHeight: 'var(--preview-line-height)',
  };

  return (
    <div className="relative p-1 sm:p-2">
      {showHeading ? (
        <p className="mb-4 ml-2 text-xs font-bold uppercase tracking-widest text-text-muted">Real-time Preview</p>
      ) : null}

      <div
        style={previewStyle}
        className="mx-auto w-full max-w-[23rem] overflow-hidden rounded-[1.75rem] border-[3px] border-[var(--preview-border)] bg-[var(--preview-bg)] shadow-2xl transition-all duration-300"
        role="group"
        aria-label="Preview of saved dashboard personalization"
      >
        <div className="flex min-h-[31rem] text-[0.78rem] text-[var(--preview-text)]">
          <aside className="w-14 shrink-0 border-r border-[var(--preview-border)] bg-[var(--preview-surface)] p-2.5">
            <div className="mb-4 h-9 rounded-2xl shadow-sm" style={{ background: preset.bg }} aria-hidden="true" />
            <nav className="space-y-2" aria-label="Preview sidebar">
              {[Home, BookOpen, Bell, Layers].map((Icon, index) => (
                <div
                  key={index}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    index === 0 ? 'text-white' : 'text-[var(--preview-muted)]'
                  }`}
                  style={index === 0 ? { background: preset.bg } : undefined}
                  aria-hidden="true"
                >
                  <Icon size={15} />
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="flex h-11 items-center justify-between border-b border-[var(--preview-border)] bg-[var(--preview-surface)] px-3">
              <div className="flex items-center gap-2">
                <Menu size={15} className="text-[var(--preview-muted)]" aria-hidden="true" />
                <span className="h-5 w-16 rounded-full bg-[var(--preview-surface-2)]" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[0.72em] font-black text-[var(--preview-text)]">Ahron</span>
                <User size={14} className="text-[var(--preview-muted)]" aria-hidden="true" />
              </div>
            </header>

            <main className="space-y-3 p-3.5">
              <section
                className="rounded-2xl p-4 shadow-sm"
                style={{ background: preset.bg, color: preset.textColor }}
              >
                <p className="mb-1 text-[0.62em] font-black uppercase tracking-[0.16em] opacity-80">Welcome back</p>
                <h4 className="text-[1.36em] font-black leading-tight">Continue studying today.</h4>
              </section>

              <section className="grid grid-cols-2 gap-2">
                <article className="rounded-2xl border border-[var(--preview-border)] bg-[var(--preview-surface)] p-3">
                  <p className="text-[0.68em] font-black uppercase tracking-[0.13em] text-[var(--preview-muted)]">Streak</p>
                  <p className="mt-1 text-[1.08em] font-black text-[var(--preview-text)]">5 Days</p>
                </article>
                <article className="rounded-2xl border border-[var(--preview-border)] bg-[var(--preview-surface)] p-3">
                  <p className="text-[0.68em] font-black uppercase tracking-[0.13em] text-[var(--preview-muted)]">Guides</p>
                  <p className="mt-1 text-[1.08em] font-black text-[var(--preview-text)]">12 Items</p>
                </article>
              </section>

              <section className="rounded-2xl border border-[var(--preview-border)] bg-[var(--preview-surface)] p-3.5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.7em] font-black uppercase tracking-[0.14em] text-[var(--preview-muted)]">
                      Study guide
                    </p>
                    <h4 className="truncate text-[1.05em] font-black text-[var(--preview-text)]">
                      Information Management
                    </h4>
                  </div>
                  <span className="rounded-full bg-[var(--preview-surface-2)] px-2 py-1 text-[0.7em] font-black text-[var(--preview-muted)]">
                    Open
                  </span>
                </div>

                <div
                  className="rounded-2xl bg-[var(--preview-surface-2)] p-3 text-[var(--preview-text)]"
                  style={{
                    fontSize: previewReaderFontSize,
                    lineHeight: 'var(--preview-line-height)',
                  }}
                >
                  <p className="mb-2 font-black">Overview</p>
                  <p className="text-[var(--preview-muted)]">
                    Study content, summaries, cards, and quiz questions follow the selected legibility preset while the main controls stay stable.
                  </p>
                </div>
              </section>

              <div
                className="min-h-10 w-full rounded-2xl px-4 py-2 text-center text-[0.82em] font-black text-white shadow-xl"
                style={{ background: preset.bg }}
                aria-hidden="true"
              >
                Continue Learning
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
