import { useAccessibility } from '../context/AccessibilityContext';
import Modal from '../../../shared/components/Modal';
import Button from '../../../shared/components/Button';

const fontOptions = [
  { id: 'default',      label: 'Default', family: 'inherit' },
  { id: 'dyslexic',     label: 'OpenDyslexic', family: 'OpenDyslexic, sans-serif' },
  { id: 'serif',        label: 'Serif', family: 'Georgia, serif' },
  { id: 'mono',         label: 'Monospace', family: 'Courier New, monospace' },
];

const themeOptions = [
  { id: 'light',        label: '☀️ Light',         '--accent': '#4361ee', '--bg': '#f5f7ff' },
  { id: 'dark',         label: '🌙 Dark',          '--accent': '#5b8dee', '--bg': '#0f1117' },
  { id: 'high-contrast',label: '⬛ High Contrast', '--accent': '#ffff00', '--bg': '#000000' },
  { id: 'warm',         label: '🟡 Warm Sepia',    '--accent': '#c87941', '--bg': '#fdf6e3' },
];

export default function AccessibilityPanel({ isOpen, onClose }) {
  const {
    theme, setTheme,
    fontSize, increaseFontSize, decreaseFontSize,
    fontFamily, setFontFamily,
    lineHeight, setLineHeight,
    letterSpacing, setLetterSpacing,
  } = useAccessibility();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="♿ Accessibility Settings" size="md">
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
            Font Size: <span aria-live="polite">{fontSize}px</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={decreaseFontSize}
              disabled={fontSize <= 12}
              aria-label="Decrease font size"
              className="w-10 h-10 rounded-full border border-[var(--card-border)] flex items-center
                         justify-center text-lg font-bold hover:bg-[var(--card-border)] transition-colors
                         disabled:opacity-40 focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-[var(--accent)]"
            >
              A-
            </button>
            <div className="flex-1 relative">
              <input
                type="range"
                min={12}
                max={28}
                step={2}
                value={fontSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > fontSize) increaseFontSize();
                  else decreaseFontSize();
                }}
                aria-label="Font size slider"
                aria-valuemin={12}
                aria-valuemax={28}
                aria-valuenow={fontSize}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <button
              onClick={increaseFontSize}
              disabled={fontSize >= 28}
              aria-label="Increase font size"
              className="w-10 h-10 rounded-full border border-[var(--card-border)] flex items-center
                         justify-center text-lg font-bold hover:bg-[var(--card-border)] transition-colors
                         disabled:opacity-40 focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-[var(--accent)]"
            >
              A+
            </button>
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