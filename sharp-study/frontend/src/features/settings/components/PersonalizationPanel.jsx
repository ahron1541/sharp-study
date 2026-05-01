import React from 'react';
import { Check, Sun, Moon, Type, Layers, Save, RotateCcw, Loader2 } from 'lucide-react';
import { 
  ATMOSPHERE_PRESETS, 
  DISPLAY_MODES, 
  FONT_FAMILIES, 
  FONT_SIZE_MIN, 
  FONT_SIZE_MAX 
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
  updateDraft,
  discardChanges,
  save,
}) {

  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-2xl font-bold text-text mb-2">Workspace Design</h2>
        <p className="text-text-muted font-medium">Customize your interface to create the perfect study atmosphere.</p>
      </header>

      {/* Theme Mode */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} /> Display Preference
        </h3>
        <div className="grid grid-cols-2 gap-4 p-1.5 bg-surface-2 rounded-3xl border border-border max-w-sm">
          {DISPLAY_MODES.map((mode) => {
            const isActive = draft.display_mode === mode.id;
            const Icon = mode.id === 'dark' ? Moon : Sun;
            return (
              <button
                key={mode.id}
                onClick={() => updateDraft('display_mode', mode.id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300 font-bold ${
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ATMOSPHERE_PRESETS.map((preset) => {
            const isActive = draft.atmosphere === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => updateDraft('atmosphere', preset.id)}
                className={`relative h-14 rounded-2xl px-6 flex items-center gap-3 transition-all duration-300 ${
                  isActive ? 'ring-2 ring-accent ring-offset-4' : 'hover:scale-102'
                }`}
                style={{ background: preset.bg, color: preset.textColor }}
              >
                {isActive && <Check size={18} />}
                <span className="font-bold">{preset.label}</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
           {FONT_FAMILIES.map((font) => {
             const isActive = draft.font_family === font.id;
             return (
                <button
                  key={font.id}
                  onClick={() => updateDraft('font_family', font.id)}
                  style={{ fontFamily: FONT_PREVIEW[font.id] }}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${
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
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest">Legibility (Font Size)</h3>
           <span className="text-accent font-black text-xl">{draft.font_size}px</span>
        </div>
        <div className="px-2">
           <input 
             type="range"
             min={FONT_SIZE_MIN}
             max={FONT_SIZE_MAX}
             value={draft.font_size}
             onChange={(e) => updateDraft('font_size', Number(e.target.value))}
             className="w-full h-3 bg-surface-2 rounded-full appearance-none cursor-pointer accent-accent"
           />
           <div className="flex justify-between mt-3 text-xs font-bold text-text-muted">
              <span>Standard (14px)</span>
              <span>Readable (22px)</span>
           </div>
        </div>
      </section>

      {/* Footer Actions */}
      <footer className="pt-8 border-t border-border flex items-center gap-4">
        <button
          onClick={save}
          disabled={!hasChanges || saving}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all ${
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
            onClick={discardChanges}
            className="px-8 py-4 rounded-2xl font-bold text-text-muted hover:bg-surface-2 transition-all flex items-center gap-2"
          >
            <RotateCcw size={18} />
            Discard
          </button>
        )}
      </footer>
    </div>
  );
}
