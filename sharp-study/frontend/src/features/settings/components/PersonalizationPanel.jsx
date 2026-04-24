import { Check, Loader2, RotateCcw, Save } from 'lucide-react';
import {
  ATMOSPHERE_PRESETS,
  DISPLAY_MODES,
  FONT_FAMILIES,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from '../../theme/constants/themes';

/**
 * Personalization settings panel.
 *
 * Props:
 *   draft         — current draft preferences
 *   hasChanges    — boolean
 *   saving        — boolean
 *   updateDraft   — (key, value) => void
 *   discardChanges — () => void
 *   onSave        — () => Promise<void>
 */
export default function PersonalizationPanel({
  draft,
  hasChanges,
  saving,
  updateDraft,
  discardChanges,
  onSave,
}) {
  return (
    <section aria-labelledby="personalization-heading" className="flex-1">
      {/* Section header */}
      <div className="mb-6">
        <h2
          id="personalization-heading"
          className="text-xl font-bold text-text"
        >
          Customize Your Workspace
        </h2>
        <p className="text-sm text-muted mt-1">
          Adjust the look and feel. Changes apply to the preview card below
          until saved.
        </p>
      </div>

      {/* ── Display Mode ── */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-text mb-3">Display Mode</h3>
        <div
          role="group"
          aria-label="Display mode options"
          className="
            inline-flex rounded-xl bg-surface-2 border border-border p-1 gap-1
          "
        >
          {DISPLAY_MODES.map((mode) => {
            const isActive = draft.display_mode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => updateDraft('display_mode', mode.id)}
                role="radio"
                aria-checked={isActive}
                aria-label={mode.label}
                className={`
                  px-5 py-2 rounded-lg text-sm font-semibold
                  transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-accent focus-visible:ring-offset-1
                  ${isActive
                    ? 'bg-surface text-accent shadow-sm'
                    : 'text-muted hover:text-text'}
                `}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Atmosphere & Gradients ── */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-text mb-3">
          Atmosphere &amp; Gradients
        </h3>
        <div
          role="group"
          aria-label="Atmosphere presets"
          className="
            grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4
            gap-3
          "
        >
          {ATMOSPHERE_PRESETS.map((preset) => {
            const isSelected = draft.atmosphere === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => updateDraft('atmosphere', preset.id)}
                aria-pressed={isSelected}
                aria-label={`${preset.label}${isSelected ? ', currently selected' : ''}`}
                className={`
                  relative h-16 rounded-xl font-semibold text-sm
                  flex items-center justify-center gap-2
                  transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-white focus-visible:ring-offset-2
                  ${isSelected ? 'ring-2 ring-offset-2 ring-white scale-[1.03]' : 'hover:scale-[1.02]'}
                `}
                style={{
                  background: preset.bg,
                  color:      preset.textColor,
                }}
              >
                {isSelected && (
                  <Check
                    size={14}
                    aria-hidden="true"
                    className="flex-shrink-0"
                  />
                )}
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Font Family ── */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-text mb-3">Font Style</h3>
        <div
          role="group"
          aria-label="Font family options"
          className="grid grid-cols-2 gap-2"
        >
          {FONT_FAMILIES.map((font) => {
            const isActive = draft.font_family === font.id;
            return (
              <button
                key={font.id}
                onClick={() => updateDraft('font_family', font.id)}
                aria-pressed={isActive}
                className={`
                  px-4 py-2.5 rounded-xl text-sm border text-left
                  transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-accent focus-visible:ring-offset-1
                  ${isActive
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border text-text hover:border-accent/50'}
                `}
              >
                {font.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Font Size ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text">Text Size</h3>
          <span
            className="text-sm font-semibold text-accent tabular-nums"
            aria-live="polite"
            aria-atomic="true"
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
          aria-label={`Text size, currently ${draft.font_size} pixels`}
          aria-valuemin={FONT_SIZE_MIN}
          aria-valuemax={FONT_SIZE_MAX}
          aria-valuenow={draft.font_size}
          className="
            w-full h-2 rounded-full appearance-none cursor-pointer
            bg-surface-2 accent-accent
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125
            focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
          "
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Smaller</span>
          <span>Larger</span>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div
        className="flex items-center gap-3 pt-4 border-t border-border"
        role="group"
        aria-label="Save or discard changes"
      >
        {/* Save */}
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          aria-label={saving ? 'Saving your preferences' : 'Save preferences'}
          aria-busy={saving}
          className={`
            flex items-center gap-2 px-5 py-2.5
            rounded-pill text-sm font-semibold
            transition-all duration-150
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-accent focus-visible:ring-offset-2
            ${hasChanges && !saving
              ? 'bg-accent text-accent-text hover:bg-accent-hover'
              : 'bg-surface-2 text-muted cursor-not-allowed'}
          `}
        >
          {saving ? (
            <>
              <Loader2
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
              Saving your preferences...
            </>
          ) : (
            <>
              <Save size={16} aria-hidden="true" />
              Save Changes
            </>
          )}
        </button>

        {/* Discard */}
        {hasChanges && !saving && (
          <button
            onClick={discardChanges}
            aria-label="Discard unsaved changes"
            className="
              flex items-center gap-2 px-4 py-2.5
              rounded-pill text-sm font-semibold
              text-muted hover:text-text
              border border-border hover:border-text/30
              transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-border focus-visible:ring-offset-2
            "
          >
            <RotateCcw size={14} aria-hidden="true" />
            Discard
          </button>
        )}
      </div>
    </section>
  );
}