import React from 'react';
import { ATMOSPHERE_PRESETS } from '../../theme/constants/themes';
import { BookOpen, CreditCard, Flame, Menu, User } from 'lucide-react';

export default function LivePreviewCard({ draft }) {
  const preset = ATMOSPHERE_PRESETS.find(p => p.id === draft.atmosphere) || ATMOSPHERE_PRESETS[0];
  const isDark = draft.display_mode === 'dark';

  const previewStyle = {
    '--color-bg': isDark ? '#020617' : '#F8FAFC',
    '--color-surface': isDark ? '#0F172A' : '#FFFFFF',
    '--color-surface-2': isDark ? '#1E293B' : '#F1F5F9',
    '--color-text': isDark ? '#F8FAFC' : '#0F172A',
    '--color-text-muted': isDark ? '#94A3B8' : '#64748B',
    '--color-border': isDark ? '#334155' : '#E2E8F0',
    fontFamily: draft.font_family === 'serif' ? 'Georgia, serif' : 
                draft.font_family === 'monospace' ? 'monospace' : 
                draft.font_family === 'syne' ? 'Syne, sans-serif' :
                draft.font_family === 'opendyslexic' ? 'Inter, Verdana, sans-serif' :
                'DM Sans, sans-serif',
    fontSize: `${Math.max(12, Number(draft.font_size) || 16) * 0.58}px`
  };

  return (
    <div className="relative group p-4">
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 ml-2">Real-time Preview</p>
      
      <div 
        style={previewStyle}
        className="w-full max-w-[18rem] mx-auto rounded-[1.75rem] border-[3px] border-border bg-bg overflow-hidden shadow-2xl transition-all duration-300"
      >
        <div className="flex min-h-[21rem]">
          <aside className="w-12 shrink-0 border-r border-border bg-surface p-2">
            <div className="mb-4 h-8 rounded-xl" style={{ background: preset.bg }} />
            <div className="space-y-2">
              <div className="h-7 rounded-lg bg-surface-2" />
              <div className="h-7 rounded-lg bg-surface-2" />
              <div className="h-7 rounded-lg bg-surface-2" />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="h-9 border-b border-border bg-surface flex items-center justify-between px-3">
              <Menu size={12} style={{ color: 'var(--color-text-muted)' }} />
              <div className="flex items-center gap-2">
                <span className="text-[0.65em] font-bold" style={{ color: 'var(--color-text)' }}>Ahron</span>
                <User size={12} style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div 
                className="rounded-2xl p-4 text-white"
                style={{ background: preset.bg, color: preset.textColor }}
              >
                <h4 className="text-[0.7em] font-bold uppercase tracking-widest opacity-70 mb-1">Welcome back</h4>
                <p className="text-[1.25em] font-black leading-tight">Continue studying today.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface border border-border p-3 rounded-2xl">
                  <Flame className="text-orange-500 mb-1" size={14} />
                  <p className="text-[0.8em] font-bold" style={{ color: 'var(--color-text)' }}>5 Days</p>
                </div>
                <div className="bg-surface border border-border p-3 rounded-2xl">
                  <BookOpen className="mb-1" size={14} style={{ color: '#3B82F6' }} />
                  <p className="text-[0.8em] font-bold" style={{ color: 'var(--color-text)' }}>12 Guides</p>
                </div>
              </div>

              <div className="bg-surface border border-border p-3 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard size={13} style={{ color: 'var(--color-text-muted)' }} />
                  <div className="h-2 w-20 bg-surface-2 rounded-full" />
                </div>
                <div className="h-2 w-full bg-surface-2 rounded-full" />
                <div className="h-2 w-2/3 bg-surface-2 rounded-full" />
              </div>

              <button 
                className="w-full py-2.5 rounded-xl font-bold text-white shadow-xl"
                style={{ background: preset.bg }}
              >
                Continue Learning
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
