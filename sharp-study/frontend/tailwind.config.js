/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // darkMode is handled via data attributes, not Tailwind's built-in
  // class strategy, so we set it to false here and use [data-display]
  // selectors in CSS instead.
  darkMode: false,
  theme: {
    extend: {
      colors: {
        // All colors read from CSS variables — theme-switching changes
        // the variables, Tailwind classes stay the same everywhere.
        accent:        'var(--color-accent)',
        'accent-hover':'var(--color-accent-hover)',
        'accent-text': 'var(--color-accent-text)',
        bg:            'var(--color-bg)',
        surface:       'var(--color-surface)',
        'surface-2':   'var(--color-surface-2)',
        border:        'var(--color-border)',
        text:          'var(--color-text)',
        muted:         'var(--color-text-muted)',
        sidebar:       'var(--color-sidebar)',
        'sidebar-text':'var(--color-sidebar-text)',
        'sidebar-active-bg':  'var(--color-sidebar-active-bg)',
        'sidebar-active-text':'var(--color-sidebar-active-text)',
      },
      borderRadius: {
        pill: '999px',
      },
      fontFamily: {
        // Controlled at runtime by CSS variable — components use font-body
        body: 'var(--font-body)',
      },
      fontSize: {
        // Controlled at runtime via --font-scale CSS variable
        // Applied on <html> so rem values cascade automatically
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(0,0,0,0.06), 0 2px 12px 0 rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px 0 rgba(0,0,0,0.10)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-left': 'slideInLeft 0.22s ease-out',
        pulse: 'pulse 1.8s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};