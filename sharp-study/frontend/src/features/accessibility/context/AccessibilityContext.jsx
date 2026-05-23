import { useState, useEffect } from 'react';
import { AccessibilityContext } from './accessibility-context-core';

const FONT_FAMILIES = {
  default:   'inherit',
  dyslexic:  'OpenDyslexic, sans-serif',
  serif:     'Georgia, serif',
  mono:      'Courier New, monospace',
};

function getInitialTheme() {
  try {
    const cachedPrefs = JSON.parse(localStorage.getItem('sharp-study-prefs') || '{}');
    if (cachedPrefs.display_mode === 'light' || cachedPrefs.display_mode === 'dark') {
      return cachedPrefs.display_mode;
    }
  } catch {
    // Fall through to the legacy accessibility preference.
  }

  return localStorage.getItem('theme') || 'light';
}

function getDisplayMode(theme) {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return null;
}

export function AccessibilityProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [fontSize, setFontSizeState] = useState(() => Number(localStorage.getItem('fontSize')) || 16);
  const [fontFamily, setFontFamilyState] = useState(() => localStorage.getItem('fontFamily') || 'default');
  const [lineHeight, setLineHeightState] = useState(() => Number(localStorage.getItem('lineHeight')) || 1.75);
  const [letterSpacing, setLetterSpacingState] = useState(() => Number(localStorage.getItem('letterSpacing')) || 0);

  useEffect(() => {
    const root = document.documentElement;
    const displayMode = getDisplayMode(theme);
    // Theme
    root.setAttribute('data-theme', theme);
    if (displayMode) {
      root.setAttribute('data-display', displayMode);
    } else {
      root.removeAttribute('data-display');
    }
    // Font size
    root.style.setProperty('--base-font-size', `${fontSize}px`);
    // Font family
    root.style.setProperty('--body-font', FONT_FAMILIES[fontFamily] || 'inherit');
    // Line height
    root.style.setProperty('--line-height', String(lineHeight));
    // Letter spacing
    root.style.setProperty('--letter-spacing', `${letterSpacing}em`);
    // Persist
    localStorage.setItem('theme', theme);
    if (theme === 'light' || theme === 'dark') {
      try {
        const cachedPrefs = JSON.parse(localStorage.getItem('sharp-study-prefs') || '{}');
        localStorage.setItem(
          'sharp-study-prefs',
          JSON.stringify({ ...cachedPrefs, display_mode: theme })
        );
      } catch {
        // localStorage parsing can fail if old data is malformed; the legacy key still persists.
      }
    }
    localStorage.setItem('fontSize', String(fontSize));
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('lineHeight', String(lineHeight));
    localStorage.setItem('letterSpacing', String(letterSpacing));
  }, [theme, fontSize, fontFamily, lineHeight, letterSpacing]);

  useEffect(() => {
    const handlePreferencesApplied = (event) => {
      const mode = event.detail?.display_mode;
      if (mode === 'light' || mode === 'dark') {
        setThemeState((current) => current === mode ? current : mode);
      }
    };

    window.addEventListener('sharp-study-preferences-applied', handlePreferencesApplied);
    return () => {
      window.removeEventListener('sharp-study-preferences-applied', handlePreferencesApplied);
    };
  }, []);

  const setTheme = (t) => setThemeState(t);
  const toggleTheme = () => setThemeState((t) => t === 'light' ? 'dark' : 'light');
  const increaseFontSize = () => setFontSizeState((s) => Math.min(s + 2, 28));
  const decreaseFontSize = () => setFontSizeState((s) => Math.max(s - 2, 12));
  const setFontFamily = (f) => setFontFamilyState(f);
  const setLineHeight = (v) => setLineHeightState(v);
  const setLetterSpacing = (v) => setLetterSpacingState(v);

  return (
    <AccessibilityContext.Provider value={{
      theme, setTheme, toggleTheme,
      fontSize, increaseFontSize, decreaseFontSize,
      fontFamily, setFontFamily,
      lineHeight, setLineHeight,
      letterSpacing, setLetterSpacing,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}
