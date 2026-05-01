import { useState, useCallback, useEffect } from 'react';
import { applyPreferences } from '../../theme/hooks/useTheme';
import { fetchPreferences, savePreferences } from '../../theme/services/preferences.service';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';
import toast from 'react-hot-toast';

export function useSettings() {
  const loadCurrent = () => {
    try {
      const raw = localStorage.getItem('sharp-study-prefs');
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : { ...DEFAULT_PREFERENCES };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  };

  const [saved, setSaved] = useState(loadCurrent);
  const [draft, setDraft] = useState(loadCurrent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchPreferences()
      .then(({ preferences }) => {
        if (!isMounted || !preferences) return;
        const nextPrefs = { ...DEFAULT_PREFERENCES, ...preferences };
        setSaved(nextPrefs);
        setDraft(nextPrefs);
        applyPreferences(nextPrefs);
      })
      .catch(() => {
        // Keep cached preferences if the backend is unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateDraft = useCallback((key, value) => {
    setDraft((prev) => {
      return { ...prev, [key]: value };
    });
  }, []);

  const discardChanges = useCallback(() => {
    setDraft({ ...saved });
    toast('Changes discarded');
  }, [saved]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await savePreferences(draft);
      applyPreferences(draft);
      setSaved({ ...draft });
      toast.success('Preferences saved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to save preferences');
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
