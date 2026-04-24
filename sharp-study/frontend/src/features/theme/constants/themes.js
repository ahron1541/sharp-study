/**
 * Atmosphere preset definitions.
 * id       — matches the data-atmosphere attribute value
 * label    — displayed in the settings UI
 * bg       — tile background for the settings grid (matches the gradient)
 * textColor — label text color inside the tile
 */
export const ATMOSPHERE_PRESETS = [
  {
    id:        'classic-solid',
    label:     'Classic Solid',
    bg:        '#2563EB',
    textColor: '#FFFFFF',
  },
  {
    id:        'ocean-breeze',
    label:     'Ocean Breeze',
    bg:        'linear-gradient(135deg, #06B6D4 0%, #0E7490 100%)',
    textColor: '#FFFFFF',
  },
  {
    id:        'discord-dark',
    label:     'Discord Dark',
    bg:        'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    textColor: '#FFFFFF',
  },
  {
    id:        'cyberpunk',
    label:     'Cyberpunk',
    bg:        'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
    textColor: '#FFFFFF',
  },
  {
    id:        'sunset-gradient',
    label:     'Sunset Gradient',
    bg:        'linear-gradient(135deg, #F97316 0%, #C2410C 100%)',
    textColor: '#FFFFFF',
  },
  {
    id:        'matcha-minimal',
    label:     'Matcha Minimal',
    bg:        'linear-gradient(135deg, #22C55E 0%, #15803D 100%)',
    textColor: '#FFFFFF',
  },
  {
    id:        'vercel-mono',
    label:     'Vercel Mono',
    bg:        'linear-gradient(135deg, #3F3F46 0%, #18181B 100%)',
    textColor: '#FAFAFA',
  },
];

export const DISPLAY_MODES = [
  { id: 'light', label: 'Light Mode' },
  { id: 'dark',  label: 'Dark Mode' },
];

export const FONT_FAMILIES = [
  { id: 'inter',         label: 'Inter (Default)' },
  { id: 'opendyslexic',  label: 'OpenDyslexic' },
  { id: 'serif',         label: 'Serif' },
  { id: 'monospace',     label: 'Monospace' },
];

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 22;
export const FONT_SIZE_DEFAULT = 16;

export const DEFAULT_PREFERENCES = {
  display_mode: 'light',
  atmosphere:   'classic-solid',
  font_family:  'inter',
  font_size:    FONT_SIZE_DEFAULT,
};