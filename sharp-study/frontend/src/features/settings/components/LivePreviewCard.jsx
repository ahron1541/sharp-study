import { ATMOSPHERE_PRESETS } from '../../theme/constants/themes';

/**
 * Renders a mini preview card that updates instantly as the user
 * tweaks settings. Shows how the accent color and display mode look.
 *
 * Props:
 *   draft — the current draft preferences object
 */
export default function LivePreviewCard({ draft }) {
  const preset = ATMOSPHERE_PRESETS.find((p) => p.id === draft.atmosphere)
    ?? ATMOSPHERE_PRESETS[0];

  const isDark    = draft.display_mode === 'dark';
  const bgColor   = isDark ? '#1A1D27' : '#FFFFFF';
  const textColor = isDark ? '#E8E8E8' : '#111827';
  const mutedColor = isDark ? '#94A3B8' : '#6B7280';
  const surfaceColor = isDark ? '#222536' : '#F9FAFB';

  return (
    <aside
      aria-label="Live theme preview"
      className="sticky top-6"
    >
      <p className="text-sm font-semibold text-text mb-3">Live Preview</p>

      <div
        className="rounded-2xl border border-border shadow-card overflow-hidden"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"          // decorative — screen readers skip this
      >
        {/* Mini topbar */}
        <div
          className="h-9 flex items-center px-3 gap-2 border-b"
          style={{ backgroundColor: bgColor, borderColor: isDark ? '#2D3348' : '#E5E7EB' }}
        >
          <div className="w-12 h-2 rounded-full" style={{ backgroundColor: surfaceColor }} />
          <div className="flex-1" />
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: surfaceColor }} />
        </div>

        {/* Mini sidebar + content row */}
        <div className="flex">
          {/* Mini sidebar */}
          <div
            className="w-10 flex flex-col gap-1 p-1.5 border-r"
            style={{ backgroundColor: bgColor, borderColor: isDark ? '#2D3348' : '#E5E7EB' }}
          >
            {/* Active nav item — shows accent color */}
            <div
              className="h-5 rounded-md"
              style={{ background: preset.bg, backgroundImage: preset.bg.startsWith('linear') ? preset.bg : undefined, backgroundColor: preset.bg.startsWith('linear') ? undefined : preset.bg }}
            />
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-5 rounded-md"
                style={{ backgroundColor: surfaceColor }}
              />
            ))}
          </div>

          {/* Mini content */}
          <div className="flex-1 p-4">
            <p
              className="font-bold text-lg mb-1"
              style={{ color: textColor, fontFamily: draft.font_family === 'inter' ? 'Inter, sans-serif' : draft.font_family === 'monospace' ? 'monospace' : 'serif' }}
            >
              Welcome Back
            </p>
            <p
              className="text-xs mb-4 leading-relaxed"
              style={{ color: mutedColor }}
            >
              This is how your fonts, colors, and gradients will look.
            </p>
            <button
              tabIndex={-1}
              className="px-4 py-2 rounded-pill text-xs font-semibold text-white"
              style={{
                background: preset.bg.startsWith('linear') ? preset.bg : preset.bg,
                backgroundColor: preset.bg.startsWith('linear') ? undefined : preset.bg,
              }}
            >
              Start Studying
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}