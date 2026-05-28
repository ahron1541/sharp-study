import { useEffect, useCallback, useRef, useState } from 'react';
import { fetchPreferences, savePreferences } from '../services/preferences.service';
import { DEFAULT_PREFERENCES, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../constants/themes';
import { supabase } from '../../auth/context/AuthContext';

export const PREFERENCES_CACHE_KEY = 'sharp-study-prefs';
export const PREFERENCES_CACHE_UPDATED_AT_KEY = 'sharp-study-prefs-updated-at';

function normalizePreferences(prefs = {}) {
  const nextPrefs = { ...DEFAULT_PREFERENCES, ...(prefs || {}) };
  const rawSize = Number(nextPrefs.font_size) || DEFAULT_PREFERENCES.font_size;
  const size = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, rawSize));

  return {
    ...nextPrefs,
    display_mode: nextPrefs.display_mode === 'dark' ? 'dark' : 'light',
    font_size: size,
  };
}

/**
 * Applies a preferences object to the document root element
 * by setting data attributes and CSS custom properties.
 * This is a pure side-effect function — no React state.
 */
export function applyPreferences(prefs, options = {}) {
  const root = document.documentElement;
  const nextPrefs = normalizePreferences(prefs);
  const { persist = true, touchCache = true } = options;

  // Display mode
  const mode = nextPrefs.display_mode;
  root.setAttribute('data-display', mode);
  root.setAttribute('data-theme', mode);

  // Atmosphere
  const atmosphere = nextPrefs.atmosphere;
  root.setAttribute('data-atmosphere', atmosphere);

  // Font family
  const font = nextPrefs.font_family;
  root.setAttribute('data-font', font);

  // Font size
  const size = nextPrefs.font_size;
  root.style.setProperty('--font-scale', '16px');
  root.style.setProperty('--base-font-size', '16px');
  root.style.setProperty('--reader-font-size', `${size}px`);

  // Persist to localStorage for instant reload without flash
  if (persist) {
    try {
      localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(nextPrefs));
      if (touchCache) {
        localStorage.setItem(PREFERENCES_CACHE_UPDATED_AT_KEY, String(Date.now()));
      }
    } catch {
      // localStorage unavailable — non-fatal
    }
  }

  window.dispatchEvent(new CustomEvent('sharp-study-preferences-applied', {
    detail: { ...nextPrefs, font_size: size },
  }));
}

/**
 * Reads cached preferences from localStorage.
 * Returns null if nothing is cached.
 */
export function getCachedPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCES_CACHE_KEY);
    return raw ? normalizePreferences(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function getPreferenceCacheUpdatedAt() {
  try {
    const value = Number(localStorage.getItem(PREFERENCES_CACHE_UPDATED_AT_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function resetPreferencesToDefault() {
  try {
    localStorage.removeItem(PREFERENCES_CACHE_KEY);
    localStorage.removeItem(PREFERENCES_CACHE_UPDATED_AT_KEY);
    localStorage.removeItem('theme');
    localStorage.removeItem('fontSize');
    localStorage.removeItem('fontFamily');
  } catch {
    // localStorage unavailable — non-fatal
  }

  applyPreferences(DEFAULT_PREFERENCES);
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

// Timeout for preferences fetch (5 seconds max)
const PREFERENCES_TIMEOUT_MS = 5000;

/**
 * useTheme — initializes theme on mount.
 *
 * Priority order:
 * 1. localStorage cache (instant, no flicker)
 * 2. Supabase profile (authoritative — overrides cache)
 * 3. OS preference (fallback for first visit)
 *
 * Returns: { saveAndApply, loadingPreferences } for programmatic preference updates.
 */
export function useTheme() {
  const [loadingPreferences, setLoadingPreferences] = useState(() => !getCachedPreferences());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Step 1: Apply cached prefs immediately to prevent flicker
    const cached = getCachedPreferences();
    if (cached) {
      applyPreferences(cached, { touchCache: false });
    } else {
      // No cache — use OS preference as temporary fallback
      applyPreferences({
        ...DEFAULT_PREFERENCES,
        display_mode: detectOSColorScheme(),
      }, { touchCache: false });
    }

    const loadPreferences = async () => {
      const requestStartedAt = Date.now();
      const token = localStorage.getItem('sharp-study-token');
      if (!token) {
        // Not logged in, stop loading
        if (isMounted.current) {
          setLoadingPreferences(false);
        }
        return;
      }

      // Only set loading if we don't have cached prefs
      if (!cached && isMounted.current) {
        setLoadingPreferences(true);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, PREFERENCES_TIMEOUT_MS);

      try {
        // Use Promise.race to implement timeout
        const { preferences } = await Promise.race([
          fetchPreferences(),
          new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('Timeout'));
            });
          })
        ]);

        if (!isMounted.current || !preferences) return;
        if (Object.keys(preferences).length > 0) {
          if (getPreferenceCacheUpdatedAt() > requestStartedAt) return;
          applyPreferences({ ...DEFAULT_PREFERENCES, ...preferences }, { touchCache: false });
        }
      } catch (error) {
        // Network error or timeout — cached/OS fallback stays in place
        // Don't log timeout errors as they're expected when server is slow
        if (
          error.name !== 'AbortError' &&
          error.message !== 'Timeout' &&
          error.message !== 'Not authenticated. Please log in again.'
        ) {
          console.warn('Failed to load preferences, using fallback:', error);
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMounted.current) {
          setLoadingPreferences(false);
        }
      }
    };

    loadPreferences();

    const reapplyCachedPreferences = () => {
      applyPreferences(getCachedPreferences() || DEFAULT_PREFERENCES, { touchCache: false });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reapplyCachedPreferences();
      }
    };

    window.addEventListener('pageshow', reapplyCachedPreferences);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.access_token) return;
      await loadPreferences();
    });

    return () => {
      isMounted.current = false;
      window.removeEventListener('pageshow', reapplyCachedPreferences);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
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

  return { saveAndApply, loadingPreferences };
}
