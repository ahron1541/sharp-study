import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../config/api';

const EMPTY_GAMIFICATION = {
  badges: [],
  recent_badges: [],
  badge_count: 0,
  streak: null,
  next_streak_milestone: null,
};

function normalizeGamification(payload) {
  const gamification = payload?.gamification || payload || {};
  const badges = Array.isArray(gamification.badges) ? gamification.badges : [];
  const recentBadges = Array.isArray(gamification.recent_badges)
    ? gamification.recent_badges
    : badges.slice(0, 5);

  return {
    badges,
    recent_badges: recentBadges,
    badge_count: Number(gamification.badge_count ?? badges.length),
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
      setError(err.message || 'Failed to load achievements.');
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
