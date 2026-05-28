import { useAccessibility } from '../context/useAccessibility';
import Modal from '../../../shared/components/Modal';
import Button from '../../../shared/components/Button';
import { FONT_SIZE_PRESETS } from '../../theme/constants/themes';

const fontOptions = [
  { id: 'default',      label: 'Default', family: 'inherit' },
  { id: 'serif',        label: 'Serif', family: 'Georgia, serif' },
  { id: 'mono',         label: 'Monospace', family: 'Courier New, monospace' },
];

const themeOptions = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function AccessibilityPanel({ isOpen, onClose }) {
  const {
    theme, setTheme,
    fontSizePreset, setFontSizePreset,
    fontFamily, setFontFamily,
    lineHeight, setLineHeight,
    letterSpacing, setLetterSpacing,
  } = useAccessibility();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Accessibility Settings" size="md">
      <div className="space-y-6">

        {/* Theme */}
        <section aria-labelledby="theme-label">
          <h3 id="theme-label" className="text-sm font-semibold text-[var(--text-color)] mb-3">
            Color Theme
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {themeOptions.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]
                           ${theme === t.id
                             ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                             : 'border-[var(--card-border)] text-[var(--text-color)] hover:border-[var(--accent)]/50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Font size */}
        <section aria-labelledby="fontsize-label">
          <h3 id="fontsize-label" className="text-sm font-semibold text-[var(--text-color)] mb-3">
            Study Text Size
          </h3>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="fontsize-label">
            {FONT_SIZE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setFontSizePreset(preset.id)}
                role="radio"
                aria-checked={fontSizePreset === preset.id}
                className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-bold transition-all
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]
                           ${fontSizePreset === preset.id
                             ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                             : 'border-[var(--card-border)] text-[var(--text-color)] hover:border-[var(--accent)]/50'}`}
              >
                <span>{preset.label}</span>
                {preset.badge ? <span className="ml-1 text-xs text-[var(--muted)]">({preset.badge})</span> : null}
              </button>
            ))}
          </div>
        </section>

        {/* Font family */}
        <section aria-labelledby="fontfamily-label">
          <h3 id="fontfamily-label" className="text-sm font-semibold text-[var(--text-color)] mb-3">
            Font Style
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {fontOptions.map((f) => (
              <button
                key={f.id}
                onClick={() => setFontFamily(f.id)}
                aria-pressed={fontFamily === f.id}
                style={{ fontFamily: f.family }}
                className={`px-4 py-2.5 rounded-xl text-sm border transition-all
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]
                           ${fontFamily === f.id
                             ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                             : 'border-[var(--card-border)] text-[var(--text-color)] hover:border-[var(--accent)]/50'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* Line height */}
        <section aria-labelledby="lineheight-label">
          <h3 id="lineheight-label" className="text-sm font-semibold text-[var(--text-color)] mb-3">
            Line Spacing: <span aria-live="polite">{lineHeight}x</span>
          </h3>
          <input
            type="range"
            min={1.2}
            max={2.5}
            step={0.1}
            value={lineHeight}
            onChange={(e) => setLineHeight(Number(e.target.value))}
            aria-label="Line height slider"
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
            <span>Compact</span><span>Spacious</span>
          </div>
        </section>

        {/* Letter spacing */}
        <section aria-labelledby="letterspacing-label">
          <h3 id="letterspacing-label" className="text-sm font-semibold text-[var(--text-color)] mb-3">
            Letter Spacing: <span aria-live="polite">{letterSpacing}em</span>
          </h3>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.02}
            value={letterSpacing}
            onChange={(e) => setLetterSpacing(Number(e.target.value))}
            aria-label="Letter spacing slider"
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
            <span>Normal</span><span>Wide</span>
          </div>
        </section>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setTheme('light');
            setFontSizePreset('medium');
            setFontFamily('default');
            setLineHeight(1.75);
            setLetterSpacing(0);
          }}
        >
          Reset to Defaults
        </Button>
      </div>
    </Modal>
  );
}
