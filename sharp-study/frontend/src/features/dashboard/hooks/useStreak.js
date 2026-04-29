import { useCallback } from 'react';
import { savePreferences } from '../../theme/services/preferences.service';

/**
 * Calculates whether the streak should be incremented based on
 * the last_date stored in preferences.
 *
 * Rules:
 * - same day as last_date  → streak unchanged
 * - day after last_date    → streak +1
 * - any other gap          → streak resets to 1
 */
export function calculateStreak(currentStreak, lastDate) {
  if (!lastDate) return { current: 1, broken: false, same: false };

  const today    = new Date();
  const last     = new Date(lastDate);
  const todayStr = today.toISOString().slice(0, 10);
  const lastStr  = last.toISOString().slice(0, 10);

  if (todayStr === lastStr) {
    return { current: currentStreak, broken: false, same: true };
  }

  // Check if yesterday
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (lastStr === yesterdayStr) {
    return { current: currentStreak + 1, broken: false, same: false };
  }

  // Gap of more than 1 day — streak broken
  return { current: 1, broken: true, same: false };
}

/**
 * Records a study session and updates streak + XP in preferences.
 * Call this whenever the user opens a study guide, completes a quiz,
 * or reviews flashcards.
 */
export async function recordStudySession(currentPrefs) {
  const today    = new Date().toISOString().slice(0, 10);
  const streak   = currentPrefs.streak ?? { current: 0, longest: 0, last_date: null };
  const result   = calculateStreak(streak.current, streak.last_date);

  if (result.same) return currentPrefs; // already studied today — no update needed

  const newCurrent = result.current;
  const newLongest = Math.max(streak.longest ?? 0, newCurrent);
  const xpGain     = newCurrent >= 7 ? 50 : newCurrent >= 3 ? 25 : 10;
  const newXP      = (currentPrefs.xp ?? 0) + xpGain;
  const newLevel   = Math.floor(newXP / 100) + 1;

  const updatedPrefs = {
    ...currentPrefs,
    streak: {
      current:   newCurrent,
      longest:   newLongest,
      last_date: today,
    },
    daily_goals: {
      ...currentPrefs.daily_goals,
      completed_today: true,
    },
    xp:    newXP,
    level: newLevel,
  };

  try {
    await savePreferences(updatedPrefs);
  } catch {
    // Non-fatal — local state still updates
  }

  return updatedPrefs;
}

/**
 * Returns the 7-day streak history array (true = studied, false = missed).
 * Used to render the weekly dots in the streak widget.
 */
export function getWeeklyHistory(lastDate, currentStreak) {
  const today  = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const dayStr = day.toISOString().slice(0, 10);

    if (!lastDate) { result.push(false); continue; }

    const last = new Date(lastDate);
    const diff = Math.round((day - last) / (1000 * 60 * 60 * 24));

    // A day is "done" if it falls within the current streak window
    const streakStart = currentStreak - 1;
    result.push(diff >= -streakStart && diff <= 0);
  }

  return result;
}