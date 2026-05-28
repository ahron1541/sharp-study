import React from 'react';
import { Check, Sun, Moon, Type, Layers, Save, RotateCcw, Loader2, Eye } from 'lucide-react';
import { 
  ATMOSPHERE_PRESETS, 
  DISPLAY_MODES, 
  FONT_FAMILIES, 
  FONT_SIZE_PRESETS,
  getFontSizePreset,
} from '../../theme/constants/themes';

const FONT_PREVIEW = {
  'dm-sans': "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  syne: "'Syne', ui-sans-serif, system-ui, sans-serif",
  opendyslexic: "'Inter', 'Verdana', ui-sans-serif, system-ui, sans-serif",
  serif: "'Georgia', 'Times New Roman', serif",
  monospace: "'Courier New', ui-monospace, monospace",
};

export default function PersonalizationPanel({
  draft,
  hasChanges,
  saving,
  blocking,
  saveState,
  updateDraft,
  discardChanges,
  save,
}) {
  const selectedFontSize = getFontSizePreset(draft.font_size_preset);

  return (
    <div className="relative space-y-12" aria-busy={blocking}>
      {blocking ? (
        <div className="absolute inset-0 z-10 rounded-[2rem] bg-bg/65 backdrop-blur-sm" aria-hidden="true" />
      ) : null}

      <header>
        <h2 className="text-2xl font-bold text-text mb-2">Workspace Design</h2>
        <p className="text-text-muted font-medium">Customize your interface to create the perfect study atmosphere.</p>
      </header>

      {/* Theme Mode */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} /> Display Preference
        </h3>
        <div className="grid max-w-sm grid-cols-1 gap-2 rounded-3xl border border-border bg-surface-2 p-1.5 sm:grid-cols-2">
          {DISPLAY_MODES.map((mode) => {
            const isActive = draft.display_mode === mode.id;
            const Icon = mode.id === 'dark' ? Moon : Sun;
            return (
              <button
                key={mode.id}
                type="button"
                disabled={blocking}
                onClick={() => updateDraft('display_mode', mode.id)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-center font-bold transition-all duration-300 ${
                  isActive 
                    ? 'bg-surface text-accent shadow-sm' 
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <Icon size={18} />
                {mode.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Atmosphere / Color */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest">Atmosphere Preset</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ATMOSPHERE_PRESETS.map((preset) => {
            const isActive = draft.atmosphere === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={blocking}
                onClick={() => updateDraft('atmosphere', preset.id)}
                className={`relative flex min-h-14 items-center gap-3 rounded-2xl px-5 py-3 text-left transition-all duration-300 ${
                  isActive ? 'ring-2 ring-accent ring-offset-4' : 'hover:scale-102'
                }`}
                style={{ background: preset.bg, color: preset.textColor }}
              >
                {isActive && <Check size={18} />}
                <span className="font-bold leading-tight">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Font Style */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
          <Type size={14} /> Typography
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
           {FONT_FAMILIES.map((font) => {
             const isActive = draft.font_family === font.id;
             return (
                <button
                  key={font.id}
                  type="button"
                  disabled={blocking}
                  onClick={() => updateDraft('font_family', font.id)}
                  style={{ fontFamily: FONT_PREVIEW[font.id] }}
                  className={`min-h-32 rounded-2xl border-2 p-4 text-left transition-all sm:p-5 ${
                    isActive 
                      ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent/10' 
                      : 'border-border bg-surface-2 text-text hover:border-accent/40'
                  }`}
                >
                  <p className="font-bold mb-1">{font.label}</p>
                  <p className="text-xs opacity-60">Comfortable for long study sessions.</p>
                </button>
             );
           })}
        </div>
      </section>

      {/* Text Size */}
      <section className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="font-size-preset-label" className="text-sm font-bold text-text-muted uppercase tracking-widest">
              Legibility
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-text-muted">
              Choose a stable study text size. Navigation and buttons stay steady.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-accent/10 px-3 py-1 text-sm font-black text-accent">
            {selectedFontSize.label}{selectedFontSize.badge ? ` (${selectedFontSize.badge})` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-labelledby="font-size-preset-label">
          {FONT_SIZE_PRESETS.map((preset) => {
            const isActive = draft.font_size_preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={blocking}
                onClick={() => updateDraft('font_size_preset', preset.id)}
                role="radio"
                aria-checked={isActive}
                className={`min-h-32 rounded-2xl border-2 p-4 text-left transition-all ${
                  isActive
                    ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent/10'
                    : 'border-border bg-surface-2 text-text hover:border-accent/40'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-black">{preset.label}</span>
                  {preset.badge ? (
                    <span className="rounded-full bg-surface px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-text-muted">
                      {preset.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-3 block text-sm font-semibold leading-6 text-current opacity-75">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-[1.75rem] border border-accent/10 bg-accent/5 p-5">
          <h4 className="flex items-center gap-2 font-bold text-accent">
            <Eye size={18} aria-hidden="true" />
            Accessibility tip
          </h4>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            Larger study text, high contrast display modes, and Dyslexia-friendly fonts can make reading easier without changing the dashboard controls.
          </p>
        </div>
      </section>

      {saveState.phase !== 'idle' ? (
        <section className="rounded-[1.8rem] border border-border bg-surface-2 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-text">{saveState.title}</p>
              <p className="mt-1 text-sm text-text-muted">{saveState.detail}</p>
            </div>
            <span className="text-sm font-black text-accent">{saveState.progress}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${Math.max(8, saveState.progress)}%` }}
            />
          </div>
        </section>
      ) : null}

      {/* Footer Actions */}
      <footer className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={save}
          disabled={!hasChanges || saving}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 font-bold transition-all sm:w-auto ${
            hasChanges 
              ? 'bg-accent text-white shadow-lg shadow-accent/20 hover:-translate-y-0.5' 
              : 'bg-surface-2 text-text-muted cursor-not-allowed opacity-50'
          }`}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
          Save My Settings
        </button>
        {hasChanges && (
          <button
            type="button"
            disabled={blocking}
            onClick={discardChanges}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 font-bold text-text-muted transition-all hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <RotateCcw size={18} />
            Discard
          </button>
        )}
      </footer>
    </div>
  );
}
