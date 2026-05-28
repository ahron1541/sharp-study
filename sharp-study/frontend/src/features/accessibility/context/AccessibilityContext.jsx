import { useState, useEffect } from 'react';
import { AccessibilityContext } from './accessibility-context-core';

const DEFAULT_ACCESSIBILITY = {
  theme: 'light',
  fontSize: 16,
  fontFamily: 'default',
  lineHeight: 1.75,
  letterSpacing: 0,
};

function readCachedPreferences() {
  try {
    return JSON.parse(localStorage.getItem('sharp-study-prefs') || '{}');
  } catch {
    return {};
  }
}

function getInitialTheme() {
  const cachedPrefs = readCachedPreferences();
  if (cachedPrefs.display_mode === 'light' || cachedPrefs.display_mode === 'dark') {
    return cachedPrefs.display_mode;
  }

  return DEFAULT_ACCESSIBILITY.theme;
}

function getInitialFontSize() {
  const cachedSize = Number(readCachedPreferences().font_size);
  return Number.isFinite(cachedSize) && cachedSize > 0 ? cachedSize : DEFAULT_ACCESSIBILITY.fontSize;
}

export function AccessibilityProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [fontSize, setFontSizeState] = useState(getInitialFontSize);
  const [fontFamily, setFontFamilyState] = useState(DEFAULT_ACCESSIBILITY.fontFamily);
  const [lineHeight, setLineHeightState] = useState(DEFAULT_ACCESSIBILITY.lineHeight);
  const [letterSpacing, setLetterSpacingState] = useState(DEFAULT_ACCESSIBILITY.letterSpacing);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-display', theme);
    }
    root.style.setProperty('--reader-font-size', `${fontSize}px`);
    root.style.setProperty('--line-height', String(lineHeight));
    root.style.setProperty('--letter-spacing', `${letterSpacing}em`);

    try {
      const cachedPrefs = readCachedPreferences();
      if (theme === 'light' || theme === 'dark') {
        localStorage.setItem(
          'sharp-study-prefs',
          JSON.stringify({ ...cachedPrefs, display_mode: theme, font_size: fontSize })
        );
      }
    } catch {
      // localStorage unavailable — non-fatal
    }
  }, [theme, fontSize, fontFamily, lineHeight, letterSpacing]);

  useEffect(() => {
    const handlePreferencesApplied = (event) => {
      const mode = event.detail?.display_mode;
      if (mode === 'light' || mode === 'dark') {
        setThemeState((current) => current === mode ? current : mode);
      }
      const nextFontSize = Number(event.detail?.font_size);
      if (Number.isFinite(nextFontSize)) {
        setFontSizeState((current) => current === nextFontSize ? current : nextFontSize);
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
