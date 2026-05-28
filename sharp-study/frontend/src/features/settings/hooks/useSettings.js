import { useRef, useState, useCallback, useEffect } from 'react';
import { applyPreferences, getPreferenceCacheUpdatedAt, normalizePreferences } from '../../theme/hooks/useTheme';
import { fetchPreferences, savePreferences } from '../../theme/services/preferences.service';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';
import { useAuth } from '../../auth/context/AuthContext';
import toast from 'react-hot-toast';

export function useSettings() {
  const { profile } = useAuth();
  const lastLocalSaveAtRef = useRef(0);
  const lastDraftChangeAtRef = useRef(0);
  const loadCurrent = () => {
    try {
      const raw = localStorage.getItem('sharp-study-prefs');
      return raw ? normalizePreferences(JSON.parse(raw)) : normalizePreferences(DEFAULT_PREFERENCES);
    } catch {
      return normalizePreferences(DEFAULT_PREFERENCES);
    }
  };

  const initialPrefs = loadCurrent();
  const [saved, setSaved] = useState(initialPrefs);
  const [draft, setDraft] = useState(initialPrefs);
  const [saveState, setSaveState] = useState({ phase: 'idle', progress: 0, title: '', detail: '' });
  const savedRef = useRef(initialPrefs);
  const draftRef = useRef(initialPrefs);

  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let isMounted = true;
    const requestStartedAt = Date.now();

    fetchPreferences()
      .then(({ preferences }) => {
        if (!isMounted || !preferences) return;
        if (getPreferenceCacheUpdatedAt() > requestStartedAt) return;
        if (lastDraftChangeAtRef.current > requestStartedAt) return;
        const nextPrefs = normalizePreferences({ ...DEFAULT_PREFERENCES, ...preferences });
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
    return () => {
      const latestSaved = savedRef.current;
      const latestDraft = draftRef.current;
      if (JSON.stringify(latestSaved) !== JSON.stringify(latestDraft)) {
        applyPreferences(latestSaved, { persist: false });
      }
    };
  }, []);

  useEffect(() => {
    if (lastLocalSaveAtRef.current && Date.now() - lastLocalSaveAtRef.current < 10000) return;
    const timerStart = Date.now();

    const profilePreferences = profile?.preferences
      ? normalizePreferences({ ...DEFAULT_PREFERENCES, ...profile.preferences })
      : null;

    if (!profilePreferences) return;

    const timer = window.setTimeout(() => {
      if (getPreferenceCacheUpdatedAt() > timerStart) return;
      if (lastDraftChangeAtRef.current > timerStart) return;
      setSaved(profilePreferences);
      setDraft(profilePreferences);
      applyPreferences(profilePreferences, { touchCache: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [profile?.preferences]);

  const updateDraft = useCallback((key, value) => {
    setDraft((prev) => {
      const next = normalizePreferences({ ...prev, [key]: value });
      lastDraftChangeAtRef.current = Date.now();
      applyPreferences(next, { persist: false });
      return next;
    });
  }, []);

  const discardChanges = useCallback((options = {}) => {
    const nextSaved = normalizePreferences(saved);
    lastDraftChangeAtRef.current = 0;
    setDraft(nextSaved);
    applyPreferences(nextSaved, { persist: false });
    if (options.notify !== false) {
      toast('Changes discarded');
    }
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
      const nextDraft = normalizePreferences(draft);
      applyPreferences(nextDraft);
      lastLocalSaveAtRef.current = Date.now();
      lastDraftChangeAtRef.current = 0;
      setSaved(nextDraft);

      setSaveState({
        phase: 'syncing',
        progress: 62,
        title: 'Syncing to your account',
        detail: 'Sending your saved settings to the database now.',
      });

      const response = await savePreferences(nextDraft);
      const syncedPrefs = normalizePreferences({ ...DEFAULT_PREFERENCES, ...(response.preferences || nextDraft) });
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
