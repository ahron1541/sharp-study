import { useState, useEffect } from 'react';
import { AccessibilityContext } from './accessibility-context-core';
import {
  DEFAULT_PREFERENCES,
  FONT_SIZE_PRESET_IDS,
  getFontSizePreset,
  getFontSizePresetIdFromSize,
} from '../../theme/constants/themes';
import { applyPreferences, normalizePreferences } from '../../theme/hooks/useTheme';

const DEFAULT_ACCESSIBILITY = {
  theme: 'light',
  fontSizePreset: 'medium',
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
  const cachedPrefs = readCachedPreferences();
  if (FONT_SIZE_PRESET_IDS.includes(cachedPrefs.font_size_preset)) {
    return cachedPrefs.font_size_preset;
  }
  return getFontSizePresetIdFromSize(cachedPrefs.font_size);
}

export function AccessibilityProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [fontSizePreset, setFontSizePresetState] = useState(getInitialFontSize);
  const [fontFamily, setFontFamilyState] = useState(DEFAULT_ACCESSIBILITY.fontFamily);
  const [lineHeight, setLineHeightState] = useState(DEFAULT_ACCESSIBILITY.lineHeight);
  const [letterSpacing, setLetterSpacingState] = useState(DEFAULT_ACCESSIBILITY.letterSpacing);
  const fontPreset = getFontSizePreset(fontSizePreset);
  const fontSize = fontPreset.fontSize;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--line-height', String(lineHeight));
    root.style.setProperty('--letter-spacing', `${letterSpacing}em`);
  }, [lineHeight, letterSpacing]);

  useEffect(() => {
    const handlePreferencesApplied = (event) => {
      const mode = event.detail?.display_mode;
      if (mode === 'light' || mode === 'dark') {
        setThemeState((current) => current === mode ? current : mode);
      }
      const preset = event.detail?.font_size_preset || getFontSizePresetIdFromSize(event.detail?.font_size);
      if (FONT_SIZE_PRESET_IDS.includes(preset)) {
        setFontSizePresetState((current) => current === preset ? current : preset);
      }
    };

    window.addEventListener('sharp-study-preferences-applied', handlePreferencesApplied);
    return () => {
      window.removeEventListener('sharp-study-preferences-applied', handlePreferencesApplied);
    };
  }, []);

  const applyCachedPreferenceUpdate = (updates) => {
    const next = normalizePreferences({ ...DEFAULT_PREFERENCES, ...readCachedPreferences(), ...updates });
    applyPreferences(next);
    setThemeState(next.display_mode);
    setFontSizePresetState(next.font_size_preset);
  };

  const setTheme = (t) => {
    if (t === 'light' || t === 'dark') {
      applyCachedPreferenceUpdate({ display_mode: t });
    }
  };
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const setFontSizePreset = (preset) => {
    if (FONT_SIZE_PRESET_IDS.includes(preset)) {
      applyCachedPreferenceUpdate({ font_size_preset: preset });
    }
  };
  const increaseFontSize = () => {
    const index = FONT_SIZE_PRESET_IDS.indexOf(fontSizePreset);
    setFontSizePreset(FONT_SIZE_PRESET_IDS[Math.min(FONT_SIZE_PRESET_IDS.length - 1, index + 1)]);
  };
  const decreaseFontSize = () => {
    const index = FONT_SIZE_PRESET_IDS.indexOf(fontSizePreset);
    setFontSizePreset(FONT_SIZE_PRESET_IDS[Math.max(0, index - 1)]);
  };
  const setFontFamily = (f) => setFontFamilyState(f);
  const setLineHeight = (v) => setLineHeightState(v);
  const setLetterSpacing = (v) => setLetterSpacingState(v);

  return (
    <AccessibilityContext.Provider value={{
      theme, setTheme, toggleTheme,
      fontSize, fontSizePreset, setFontSizePreset, increaseFontSize, decreaseFontSize,
      fontFamily, setFontFamily,
      lineHeight, setLineHeight,
      letterSpacing, setLetterSpacing,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}
