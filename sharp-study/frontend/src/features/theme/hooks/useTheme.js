import { useEffect, useCallback, useRef } from 'react';
import { fetchPreferences, savePreferences } from '../services/preferences.service';
import { DEFAULT_PREFERENCES } from '../constants/themes';

/**
 * Applies a preferences object to the document root element
 * by setting data attributes and CSS custom properties.
 * This is a pure side-effect function — no React state.
 */
export function applyPreferences(prefs) {
  const root = document.documentElement;

  // Display mode
  const mode = prefs.display_mode ?? DEFAULT_PREFERENCES.display_mode;
  root.setAttribute('data-display', mode);

  // Atmosphere
  const atmosphere = prefs.atmosphere ?? DEFAULT_PREFERENCES.atmosphere;
  root.setAttribute('data-atmosphere', atmosphere);

  // Font family
  const font = prefs.font_family ?? DEFAULT_PREFERENCES.font_family;
  root.setAttribute('data-font', font);

  // Font size
  const size = prefs.font_size ?? DEFAULT_PREFERENCES.font_size;
  root.style.setProperty('--font-scale', `${size}px`);

  // Persist to localStorage for instant reload without flash
  try {
    localStorage.setItem('sharp-study-prefs', JSON.stringify(prefs));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

/**
 * Reads cached preferences from localStorage.
 * Returns null if nothing is cached.
 */
function getCachedPreferences() {
  try {
    const raw = localStorage.getItem('sharp-study-prefs');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Detects OS-level color scheme preference.
 * Returns 'dark' or 'light'.
 */
function detectOSColorScheme() {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

/**
 * useTheme — initializes theme on mount.
 *
 * Priority order:
 * 1. localStorage cache (instant, no flicker)
 * 2. Supabase profile (authoritative — overrides cache)
 * 3. OS preference (fallback for first visit)
 *
 * Returns: { saveAndApply } for programmatic preference updates.
 */
export function useTheme() {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Step 1: Apply cached prefs immediately to prevent flicker
    const cached = getCachedPreferences();
    if (cached) {
      applyPreferences(cached);
    } else {
      // No cache — use OS preference as temporary fallback
      applyPreferences({
        ...DEFAULT_PREFERENCES,
        display_mode: detectOSColorScheme(),
      });
    }

    // Step 2: Fetch authoritative preferences from Supabase
    const token = localStorage.getItem('sharp-study-token');
    if (!token) return; // not logged in — keep fallback

    fetchPreferences()
      .then(({ preferences }) => {
        if (!isMounted.current) return;
        if (preferences && Object.keys(preferences).length > 0) {
          applyPreferences({ ...DEFAULT_PREFERENCES, ...preferences });
        }
      })
      .catch(() => {
        // Network error — cached/OS fallback stays in place
      });

    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * saveAndApply — persists new preferences to Supabase and applies them.
   * Use this in the Settings save action.
   */
  const saveAndApply = useCallback(async (newPrefs) => {
    applyPreferences(newPrefs);
    await savePreferences(newPrefs);
  }, []);

  return { saveAndApply };
}