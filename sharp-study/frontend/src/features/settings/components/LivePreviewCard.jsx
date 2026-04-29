import { ATMOSPHERE_PRESETS } from '../../theme/constants/themes';

export default function LivePreviewCard({ draft }) {
  const preset = ATMOSPHERE_PRESETS.find((p) => p.id === draft.atmosphere)
    ?? ATMOSPHERE_PRESETS[0];

  const isDark    = draft.display_mode === 'dark';
  const surface   = isDark ? '#141720' : '#FFFFFF';
  const surface2  = isDark ? '#1C1F2E' : '#F7F8FC';
  const textMain  = isDark ? '#EDF0F7' : '#0D1117';
  const textMuted = isDark ? '#8892A4' : '#6B7280';
  const border    = isDark ? '#252A3D' : '#E4E7EF';
  const bg        = isDark ? '#0B0D14' : '#F0F2F7';

  return (
    <div className="sticky top-4">
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Live Preview
      </p>

      <div
        className="rounded-2xl overflow-hidden border shadow-sm"
        style={{ background: bg, borderColor: border }}
        aria-hidden="true"
      >
        {/* Mini topbar */}
        <div
          className="h-7 flex items-center px-2.5 gap-1.5 border-b"
          style={{ background: surface, borderColor: border }}
        >
          <div className="w-8 h-1.5 rounded-full" style={{ background: surface2 }} />
          <div className="flex-1" />
          <div className="w-3.5 h-3.5 rounded-full" style={{ background: surface2 }} />
        </div>

        {/* Body */}
        <div className="flex" style={{ background: bg }}>
          {/* Mini sidebar */}
          <div
            className="w-8 flex flex-col gap-1 p-1 border-r"
            style={{ background: surface, borderColor: border }}
          >
            <div
              className="h-4 rounded"
              style={{ background: preset.bg }}
            />
            {[0, 1].map((i) => (
              <div key={i} className="h-4 rounded" style={{ background: surface2 }} />
            ))}
          </div>

          {/* Mini content */}
          <div className="flex-1 p-3">
            <p
              className="font-black text-xs mb-0.5 leading-tight"
              style={{ color: textMain }}
            >
              Welcome Back
            </p>
            <p className="text-[9px] mb-3 leading-relaxed" style={{ color: textMuted }}>
              This is how your fonts, colors, and gradients will look.
            </p>
            <button
              tabIndex={-1}
              className="px-3 py-1 rounded-lg text-[10px] font-bold text-white"
              style={{ background: preset.bg }}
            >
              Start Studying
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}