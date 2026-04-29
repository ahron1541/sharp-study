import { Check, Loader2, RotateCcw, Save, Sun, Moon } from 'lucide-react';
import {
  ATMOSPHERE_PRESETS, DISPLAY_MODES, FONT_FAMILIES,
  FONT_SIZE_MIN, FONT_SIZE_MAX,
} from '../../theme/constants/themes';

export default function PersonalizationPanel({
  draft, hasChanges, saving, updateDraft, discardChanges, onSave,
}) {
  return (
    <section aria-labelledby="personalization-heading" className="flex-1 max-w-2xl">

      {/* Header */}
      <div className="mb-5">
        <h2
          id="personalization-heading"
          className="text-base font-bold mb-0.5"
          style={{ color: 'var(--color-text)' }}
        >
          Customize Your Workspace
        </h2>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Changes show in the preview instantly. Click Save to apply permanently.
        </p>
      </div>

      {/* Display Mode */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-text-muted)' }}>
          Display Mode
        </p>
        <div
          className="inline-flex rounded-xl p-1 gap-1"
          role="group"
          aria-label="Display mode"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          {DISPLAY_MODES.map((mode) => {
            const isActive = draft.display_mode === mode.id;
            const ModeIcon = mode.id === 'dark' ? Moon : Sun;
            return (
              <button
                key={mode.id}
                onClick={() => updateDraft('display_mode', mode.id)}
                role="radio"
                aria-checked={isActive}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                           transition-all duration-150 focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{
                  background:  isActive ? 'var(--color-surface)' : 'transparent',
                  color:       isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  boxShadow:   isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  '--tw-ring-color': 'var(--color-accent)',
                }}
              >
                <ModeIcon size={14} aria-hidden="true" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Atmosphere presets */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-text-muted)' }}>
          Atmosphere &amp; Gradients
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
          role="group"
          aria-label="Color atmosphere"
        >
          {ATMOSPHERE_PRESETS.map((preset) => {
            const isSelected = draft.atmosphere === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => updateDraft('atmosphere', preset.id)}
                aria-pressed={isSelected}
                aria-label={`${preset.label}${isSelected ? ' (selected)' : ''}`}
                className="relative h-12 rounded-xl text-xs font-bold
                           flex items-center justify-center gap-1.5
                           transition-all duration-150 focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
                style={{
                  background:  preset.bg,
                  color:       preset.textColor,
                  boxShadow:   isSelected ? '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent)' : 'none',
                  transform:   isSelected ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                {isSelected && <Check size={12} aria-hidden="true" />}
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Font family */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2"
           style={{ color: 'var(--color-text-muted)' }}>
          Font Style
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="Font family">
          {FONT_FAMILIES.map((font) => {
            const isActive = draft.font_family === font.id;
            return (
              <button
                key={font.id}
                onClick={() => updateDraft('font_family', font.id)}
                aria-pressed={isActive}
                className="px-3 py-2.5 rounded-xl text-sm border text-left
                           transition-all focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{
                  borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                  background:  isActive ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-surface)',
                  color:       isActive ? 'var(--color-accent)' : 'var(--color-text)',
                  fontWeight:  isActive ? '600' : '400',
                  '--tw-ring-color': 'var(--color-accent)',
                }}
              >
                {font.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Font size */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-text-muted)' }}>
            Text Size
          </p>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: 'var(--color-accent)' }}
            aria-live="polite"
          >
            {draft.font_size}px
          </span>
        </div>
        <input
          type="range"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={1}
          value={draft.font_size}
          onChange={(e) => updateDraft('font_size', Number(e.target.value))}
          aria-label={`Text size: ${draft.font_size}px`}
          aria-valuemin={FONT_SIZE_MIN}
          aria-valuemax={FONT_SIZE_MAX}
          aria-valuenow={draft.font_size}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            accentColor: 'var(--color-accent)',
            background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${((draft.font_size - FONT_SIZE_MIN) / (FONT_SIZE_MAX - FONT_SIZE_MIN)) * 100}%, var(--color-surface-2) ${((draft.font_size - FONT_SIZE_MIN) / (FONT_SIZE_MAX - FONT_SIZE_MIN)) * 100}%, var(--color-surface-2) 100%)`,
            '--tw-ring-color': 'var(--color-accent)',
          }}
        />
        <div className="flex justify-between text-xs mt-1"
             style={{ color: 'var(--color-text-muted)' }}>
          <span>Smaller</span>
          <span>Larger</span>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 pt-4 border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          aria-label={saving ? 'Saving...' : 'Save preferences'}
          aria-busy={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                     transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background:  hasChanges && !saving ? 'var(--color-accent)' : 'var(--color-surface-2)',
            color:       hasChanges && !saving ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
            cursor:      !hasChanges || saving ? 'not-allowed' : 'pointer',
            '--tw-ring-color': 'var(--color-accent)',
          }}
        >
          {saving
            ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving...</>
            : <><Save    size={14} aria-hidden="true" /> Save Changes</>}
        </button>

        {hasChanges && !saving && (
          <button
            onClick={discardChanges}
            aria-label="Discard unsaved changes"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                       border transition-all focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              borderColor: 'var(--color-border)',
              color:       'var(--color-text-muted)',
              '--tw-ring-color': 'var(--color-border)',
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Discard
          </button>
        )}
      </div>
    </section>
  );
}