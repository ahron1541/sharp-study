export const ATMOSPHERE_PRESETS = [
  { id: 'classic-solid',   label: 'Classic Solid',    bg: '#2563EB',                                                         textColor: '#FFFFFF' },
  { id: 'ocean-breeze',    label: 'Ocean Breeze',     bg: 'linear-gradient(135deg, #22D3EE 0%, #0E7490 100%)',               textColor: '#FFFFFF' },
  { id: 'discord-dark',    label: 'Discord Dark',     bg: 'linear-gradient(135deg, #A78BFA 0%, #6D28D9 100%)',               textColor: '#FFFFFF' },
  { id: 'cyberpunk',       label: 'Cyberpunk',        bg: 'linear-gradient(135deg, #F472B6 0%, #BE185D 100%)',               textColor: '#FFFFFF' },
  { id: 'sunset-gradient', label: 'Sunset Gradient',  bg: 'linear-gradient(135deg, #FB923C 0%, #C2410C 100%)',               textColor: '#FFFFFF' },
  { id: 'matcha-minimal',  label: 'Matcha Minimal',   bg: 'linear-gradient(135deg, #4ADE80 0%, #15803D 100%)',               textColor: '#FFFFFF' },
  { id: 'vercel-mono',     label: 'Vercel Mono',      bg: 'linear-gradient(135deg, #52525B 0%, #18181B 100%)',               textColor: '#FAFAFA' },
  { id: 'aurora',          label: 'Aurora',           bg: 'linear-gradient(135deg, #38BDF8 0%, #6366F1 100%)',               textColor: '#FFFFFF' },
  { id: 'rose-gold',       label: 'Rose Gold',        bg: 'linear-gradient(135deg, #FB7185 0%, #9F1239 100%)',               textColor: '#FFFFFF' },
  { id: 'forest',          label: 'Forest',           bg: 'linear-gradient(135deg, #34D399 0%, #064E3B 100%)',               textColor: '#FFFFFF' },
];

export const DISPLAY_MODES = [
  { id: 'light', label: 'Light Mode' },
  { id: 'dark',  label: 'Dark Mode' },
];

export const FONT_FAMILIES = [
  { id: 'dm-sans',       label: 'DM Sans (Default)',   sample: 'Aa' },
  { id: 'syne',          label: 'Syne',                sample: 'Aa' },
  { id: 'opendyslexic',  label: 'Dyslexia Friendly',   sample: 'Aa' },
  { id: 'serif',         label: 'Serif',               sample: 'Aa' },
  { id: 'monospace',     label: 'Monospace',           sample: 'Aa' },
];

export const FONT_SIZE_PRESETS = [
  {
    id: 'small',
    label: 'Small',
    description: 'Compact study text for dense review.',
    fontSize: 15,
    readerFontSize: '15px',
    learningFontSize: '0.95rem',
    lineHeight: 1.68,
  },
  {
    id: 'medium',
    label: 'Medium',
    badge: 'Default',
    description: 'Balanced reading size for everyday study.',
    fontSize: 16,
    readerFontSize: '16px',
    learningFontSize: '1rem',
    lineHeight: 1.75,
  },
  {
    id: 'large',
    label: 'Large',
    description: 'More breathing room for longer sessions.',
    fontSize: 18,
    readerFontSize: '18px',
    learningFontSize: '1.075rem',
    lineHeight: 1.82,
  },
  {
    id: 'extra-large',
    label: 'Extra Large',
    description: 'Highest legibility without stretching controls.',
    fontSize: 20,
    readerFontSize: '20px',
    learningFontSize: '1.15rem',
    lineHeight: 1.9,
  },
];

export const FONT_SIZE_PRESET_IDS = FONT_SIZE_PRESETS.map((preset) => preset.id);
export const FONT_SIZE_DEFAULT_PRESET = 'medium';
export const FONT_SIZE_DEFAULT = 16;

export function getFontSizePresetIdFromSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) return FONT_SIZE_DEFAULT_PRESET;
  if (size <= 15) return 'small';
  if (size <= 17) return 'medium';
  if (size <= 19) return 'large';
  return 'extra-large';
}

export function getFontSizePreset(value) {
  return FONT_SIZE_PRESETS.find((preset) => preset.id === value)
    || FONT_SIZE_PRESETS.find((preset) => preset.id === FONT_SIZE_DEFAULT_PRESET)
    || FONT_SIZE_PRESETS[1];
}

export const DEFAULT_PREFERENCES = {
  display_mode: 'light',
  atmosphere:   'classic-solid',
  font_family:  'dm-sans',
  font_size_preset: FONT_SIZE_DEFAULT_PRESET,
  font_size:    FONT_SIZE_DEFAULT,
};
