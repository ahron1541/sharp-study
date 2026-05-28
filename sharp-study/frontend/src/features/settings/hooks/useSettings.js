import { useRef, useState, useCallback, useEffect } from 'react';
import { applyPreferences, getPreferenceCacheUpdatedAt } from '../../theme/hooks/useTheme';
import { fetchPreferences, savePreferences } from '../../theme/services/preferences.service';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';
import { useAuth } from '../../auth/context/AuthContext';
import toast from 'react-hot-toast';

export function useSettings() {
  const { profile } = useAuth();
  const lastLocalSaveAtRef = useRef(0);
  const loadCurrent = () => {
    try {
      const raw = localStorage.getItem('sharp-study-prefs');
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : { ...DEFAULT_PREFERENCES };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  };

  const initialPrefs = loadCurrent();
  const [saved, setSaved] = useState(initialPrefs);
  const [draft, setDraft] = useState(initialPrefs);
  const [saveState, setSaveState] = useState({ phase: 'idle', progress: 0, title: '', detail: '' });

  useEffect(() => {
    let isMounted = true;
    const requestStartedAt = Date.now();

    fetchPreferences()
      .then(({ preferences }) => {
        if (!isMounted || !preferences) return;
        if (getPreferenceCacheUpdatedAt() > requestStartedAt) return;
        const nextPrefs = { ...DEFAULT_PREFERENCES, ...preferences };
        setSaved(nextPrefs);
        setDraft(nextPrefs);
        applyPreferences(nextPrefs, { touchCache: false });
      })
      .catch(() => {
        // Keep cached preferences if the backend is unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (lastLocalSaveAtRef.current && Date.now() - lastLocalSaveAtRef.current < 10000) return;
    const timerStart = Date.now();

    const profilePreferences = profile?.preferences
      ? { ...DEFAULT_PREFERENCES, ...profile.preferences }
      : null;

    if (!profilePreferences) return;

    const timer = window.setTimeout(() => {
      if (getPreferenceCacheUpdatedAt() > timerStart) return;
      setSaved(profilePreferences);
      setDraft(profilePreferences);
      applyPreferences(profilePreferences, { touchCache: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [profile?.preferences]);

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
  const blocking = saveState.phase === 'saving' || saveState.phase === 'syncing';

  const save = useCallback(async () => {
    setSaveState({
      phase: 'saving',
      progress: 24,
      title: 'Saving on this device',
      detail: 'Locking in your preferences locally before syncing them safely.',
    });

    try {
      applyPreferences(draft);
      lastLocalSaveAtRef.current = Date.now();
      setSaved({ ...draft });

      setSaveState({
        phase: 'syncing',
        progress: 62,
        title: 'Syncing to your account',
        detail: 'Sending your saved settings to the database now.',
      });

      const response = await savePreferences(draft);
      const syncedPrefs = { ...DEFAULT_PREFERENCES, ...(response.preferences || draft) };
      setSaved(syncedPrefs);
      setDraft(syncedPrefs);
      applyPreferences(syncedPrefs, { touchCache: false });
      setSaveState({ phase: 'idle', progress: 0, title: '', detail: '' });
      toast.success('Settings saved and synced.');
    } catch (err) {
      setSaveState({
        phase: 'error',
        progress: 100,
        title: 'Saved on this device',
        detail: 'Account sync did not finish. Your local settings are still active.',
      });
      toast.error(err.message || 'Settings saved locally, but account sync failed.');
    }
  }, [draft]);

  return {
    draft,
    saved,
    saving: blocking,
    saveState,
    blocking,
    hasChanges,
    updateDraft,
    discardChanges,
    save,
  };
}
