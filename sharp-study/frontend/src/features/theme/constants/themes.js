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

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 22;
export const FONT_SIZE_DEFAULT = 16;

export const DEFAULT_PREFERENCES = {
  display_mode: 'light',
  atmosphere:   'classic-solid',
  font_family:  'dm-sans',
  font_size:    FONT_SIZE_DEFAULT,
};