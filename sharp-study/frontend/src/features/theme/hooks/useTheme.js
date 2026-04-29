import { useEffect, useCallback, useRef, useState } from 'react';
import { fetchPreferences, savePreferences } from '../services/preferences.service';
import { DEFAULT_PREFERENCES } from '../constants/themes';
import { supabase } from '../../auth/context/AuthContext';

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
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Step 1: Apply cached prefs immediately to prevent flicker
    const cached = getCachedPreferences();
    if (cached) {
      applyPreferences(cached);
      // If cached, we're not "loading" - user sees instant result
      setLoadingPreferences(false);
    } else {
      // No cache — use OS preference as temporary fallback
      applyPreferences({
        ...DEFAULT_PREFERENCES,
        display_mode: detectOSColorScheme(),
      });
      // Still loading since we need to fetch from server
      setLoadingPreferences(true);
    }

    const loadPreferences = async () => {
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
          applyPreferences({ ...DEFAULT_PREFERENCES, ...preferences });
        }
      } catch (error) {
        // Network error or timeout — cached/OS fallback stays in place
        // Don't log timeout errors as they're expected when server is slow
        if (error.name !== 'AbortError' && error.message !== 'Timeout') {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.access_token) return;
      await loadPreferences();
    });

    return () => {
      isMounted.current = false;
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