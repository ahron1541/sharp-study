import { useState, useCallback } from 'react';
import { applyPreferences } from '../../theme/hooks/useTheme';
import { savePreferences }  from '../../theme/services/preferences.service';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';
import toast from 'react-hot-toast';

/**
 * Manages settings page state.
 *
 * Keeps two copies of preferences:
 * - saved:   the last state persisted to Supabase (reference copy)
 * - draft:   the live preview state (updated instantly on interaction)
 *
 * Only when the user clicks "Save" does the draft get committed to saved + Supabase.
 */
export function useSettings() {
  // Load initial from localStorage
  const loadCurrent = () => {
    try {
      const raw = localStorage.getItem('sharp-study-prefs');
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : { ...DEFAULT_PREFERENCES };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  };

  const [saved,   setSaved]   = useState(() => loadCurrent());
  const [draft,   setDraft]   = useState(() => loadCurrent());
  const [saving,  setSaving]  = useState(false);

  /** Update a single field in the draft and apply instantly for live preview */
  const updateDraft = useCallback((key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      applyPreferences(next); // live preview — applies to document root immediately
      return next;
    });
  }, []);

  /** Discard unsaved changes — restore to last saved state */
  const discardChanges = useCallback(() => {
    setDraft({ ...saved });
    applyPreferences(saved);
  }, [saved]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(saved);

  /** Persist draft to Supabase */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await savePreferences(draft);
      setSaved({ ...draft });
      toast.success('Preferences saved.');
    } catch (err) {
      // Print the full error to the console and show the actual message on the screen
      console.error("FULL ERROR DETAILS:", err);
      toast.error(`Error: ${err.message}`, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }, [draft]);

  return {
    draft,
    saved,
    saving,
    hasChanges,
    updateDraft,
    discardChanges,
    save,
  };
}