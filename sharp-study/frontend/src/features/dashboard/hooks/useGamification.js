import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../config/api';

const EMPTY_GAMIFICATION = {
  xp_total: 0,
  level: 1,
  streak_freezes_available: 0,
  level_progress: {
    current_level: 1,
    next_level: 2,
    current_level_xp: 0,
    next_level_xp: 100,
    xp_into_level: 0,
    xp_needed: 100,
    percent: 0,
  },
  badges: [],
  recent_events: [],
  streak: null,
  next_streak_milestone: null,
};

function normalizeGamification(payload) {
  const gamification = payload?.gamification || payload || {};
  const levelProgress = gamification.level_progress || {};

  return {
    xp_total: Number(gamification.xp_total || 0),
    level: Number(gamification.level || 1),
    streak_freezes_available: Number(gamification.streak_freezes_available || 0),
    level_progress: {
      current_level: Number(levelProgress.current_level || gamification.level || 1),
      next_level: Number(levelProgress.next_level || (Number(gamification.level || 1) + 1)),
      current_level_xp: Number(levelProgress.current_level_xp || 0),
      next_level_xp: Number(levelProgress.next_level_xp || 100),
      xp_into_level: Number(levelProgress.xp_into_level || 0),
      xp_needed: Number(levelProgress.xp_needed || 100),
      percent: Math.max(0, Math.min(100, Number(levelProgress.percent || 0))),
    },
    badges: Array.isArray(gamification.badges) ? gamification.badges : [],
    recent_events: Array.isArray(gamification.recent_events) ? gamification.recent_events : [],
    streak: gamification.streak || null,
    next_streak_milestone: gamification.next_streak_milestone || null,
  };
}

export function useGamification(options = {}) {
  const { days = 35 } = options;
  const [gamification, setGamification] = useState(EMPTY_GAMIFICATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchGamification = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest(`/api/gamification/summary?days=${encodeURIComponent(days)}`);
      setGamification(normalizeGamification(response));
    } catch (err) {
      setError(err.message || 'Failed to load rewards.');
      setGamification(EMPTY_GAMIFICATION);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const timer = window.setTimeout(fetchGamification, 0);
    return () => window.clearTimeout(timer);
  }, [fetchGamification]);

  return {
    gamification,
    loading,
    error,
    refetch: fetchGamification,
  };
}
