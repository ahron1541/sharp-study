import { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSizeState] = useState(() => Number(localStorage.getItem('fontSize')) || 16);
  const [fontFamily, setFontFamilyState] = useState(() => localStorage.getItem('fontFamily') || 'default');
  const [lineHeight, setLineHeightState] = useState(() => Number(localStorage.getItem('lineHeight')) || 1.75);
  const [letterSpacing, setLetterSpacingState] = useState(() => Number(localStorage.getItem('letterSpacing')) || 0);

  const fontFamilies = {
    default:   'inherit',
    dyslexic:  'OpenDyslexic, sans-serif',
    serif:     'Georgia, serif',
    mono:      'Courier New, monospace',
  };

  useEffect(() => {
    const root = document.documentElement;
    // Theme
    root.setAttribute('data-theme', theme);
    // Font size
    root.style.setProperty('--base-font-size', `${fontSize}px`);
    // Font family
    root.style.setProperty('--body-font', fontFamilies[fontFamily] || 'inherit');
    // Line height
    root.style.setProperty('--line-height', String(lineHeight));
    // Letter spacing
    root.style.setProperty('--letter-spacing', `${letterSpacing}em`);
    // Persist
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', String(fontSize));
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('lineHeight', String(lineHeight));
    localStorage.setItem('letterSpacing', String(letterSpacing));
  }, [theme, fontSize, fontFamily, lineHeight, letterSpacing]);

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

export const useAccessibility = () => useContext(AccessibilityContext);