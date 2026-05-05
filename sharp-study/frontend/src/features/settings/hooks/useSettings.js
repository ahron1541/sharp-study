import { useState, useCallback, useEffect } from 'react';
import { applyPreferences } from '../../theme/hooks/useTheme';
import { fetchPreferences, savePreferences } from '../../theme/services/preferences.service';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';
import { useAuth } from '../../auth/context/AuthContext';
import toast from 'react-hot-toast';

const PENDING_SYNC_KEY = 'sharp-study-prefs-pending';
const PENDING_SYNC_AT_KEY = 'sharp-study-prefs-pending-at';
const SYNC_DELAY_MS = 15000;

export function useSettings() {
  const { profile } = useAuth();
  const loadCurrent = () => {
    try {
      const raw = localStorage.getItem('sharp-study-prefs');
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : { ...DEFAULT_PREFERENCES };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  };

  const loadPending = () => {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_KEY);
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : null;
    } catch {
      return null;
    }
  };

  const getPendingQueuedAt = () => {
    const raw = Number(localStorage.getItem(PENDING_SYNC_AT_KEY) || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  };

  const persistPending = (preferences, queuedAt) => {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(preferences));
    localStorage.setItem(PENDING_SYNC_AT_KEY, String(queuedAt));
  };

  const clearPending = () => {
    localStorage.removeItem(PENDING_SYNC_KEY);
    localStorage.removeItem(PENDING_SYNC_AT_KEY);
  };

  const initialPrefs = loadPending() || loadCurrent();
  const [saved, setSaved] = useState(initialPrefs);
  const [draft, setDraft] = useState(initialPrefs);
  const [saveState, setSaveState] = useState(() => {
    const pendingPrefs = loadPending();
    if (!pendingPrefs) {
      return { phase: 'idle', progress: 0, title: '', detail: '', queuedAt: 0 };
    }

    return {
      phase: 'queued',
      progress: 100,
      title: 'Saved on this device',
      detail: 'Your preferences are queued to sync to your account shortly.',
      queuedAt: getPendingQueuedAt(),
    };
  });

  useEffect(() => {
    let isMounted = true;
    const pendingOnLoad = loadPending();
    if (pendingOnLoad && isMounted) {
      applyPreferences(pendingOnLoad);
    }

    fetchPreferences()
      .then(({ preferences }) => {
        if (!isMounted || !preferences) return;
        if (loadPending()) return;
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

  useEffect(() => {
    if (loadPending()) return;

    const profilePreferences = profile?.preferences
      ? { ...DEFAULT_PREFERENCES, ...profile.preferences }
      : null;

    if (!profilePreferences) return;

    const timer = window.setTimeout(() => {
      setSaved(profilePreferences);
      setDraft(profilePreferences);
      applyPreferences(profilePreferences);
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
      queuedAt: 0,
    });

    try {
      applyPreferences(draft);
      setSaved({ ...draft });
      await new Promise((resolve) => window.setTimeout(resolve, 350));

      const queuedAt = Date.now();
      persistPending(draft, queuedAt);

      setSaveState({
        phase: 'queued',
        progress: 100,
        title: 'Saved on this device',
        detail: `Your preferences will sync to your account in about ${Math.ceil(SYNC_DELAY_MS / 1000)} seconds.`,
        queuedAt,
      });

      toast.success('Settings saved on this device. Account sync is queued.');
    } catch (err) {
      setSaveState({ phase: 'idle', progress: 0, title: '', detail: '', queuedAt: 0 });
      toast.error(err.message || 'Failed to save preferences');
    }
  }, [draft]);

  useEffect(() => {
    if (saveState.phase !== 'queued' || !saveState.queuedAt) return undefined;

    const timer = window.setTimeout(async () => {
      const pendingPrefs = loadPending();
      if (!pendingPrefs) {
        setSaveState({ phase: 'idle', progress: 0, title: '', detail: '', queuedAt: 0 });
        return;
      }

      setSaveState({
        phase: 'syncing',
        progress: 42,
        title: 'Syncing to your account',
        detail: 'Sending your saved settings to the database now.',
        queuedAt: saveState.queuedAt,
      });

      try {
        setSaveState((current) => ({ ...current, progress: 78 }));
        await savePreferences(pendingPrefs);
        clearPending();
        setSaveState({ phase: 'idle', progress: 0, title: '', detail: '', queuedAt: 0 });
      } catch (err) {
        setSaveState({
          phase: 'queued',
          progress: 100,
          title: 'Saved on this device',
          detail: 'Sync did not finish yet. We will retry again from this browser session.',
          queuedAt: Date.now(),
        });
        toast.error(err.message || 'Preferences are queued and will retry syncing.');
      }
    }, Math.max(0, SYNC_DELAY_MS - (Date.now() - saveState.queuedAt)));

    return () => window.clearTimeout(timer);
  }, [saveState.phase, saveState.queuedAt]);

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
