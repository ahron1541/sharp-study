import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../config/api';

const EMPTY_STREAK = {
  current: 0,
  longest: 0,
  last_activity_date: null,
  today_active: false,
  timezone: 'Asia/Manila',
  history: [],
};

function normalizeStreak(payload) {
  const streak = payload?.streak || payload || {};
  const history = Array.isArray(streak.history)
    ? streak.history
      .map((entry) => ({
        date: String(entry?.date || '').slice(0, 10),
        activity_count: Number(entry?.activity_count || 0),
        activity_counts: entry?.activity_counts && typeof entry.activity_counts === 'object'
          ? entry.activity_counts
          : {},
      }))
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    : [];

  return {
    current: Number(streak.current || 0),
    longest: Number(streak.longest || 0),
    last_activity_date: streak.last_activity_date || null,
    today_active: Boolean(streak.today_active),
    timezone: streak.timezone || EMPTY_STREAK.timezone,
    history,
  };
}

export function useStreak(options = {}) {
  const { days = 35 } = options;
  const [streak, setStreak] = useState(EMPTY_STREAK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStreak = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest(`/api/streak?days=${encodeURIComponent(days)}`);
      setStreak(normalizeStreak(response));
    } catch (err) {
      setError(err.message || 'Failed to load study streak.');
      setStreak(EMPTY_STREAK);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const timer = window.setTimeout(fetchStreak, 0);
    return () => window.clearTimeout(timer);
  }, [fetchStreak]);

  return {
    streak,
    loading,
    error,
    refetch: fetchStreak,
  };
}
