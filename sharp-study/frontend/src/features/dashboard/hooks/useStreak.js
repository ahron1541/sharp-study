export function calculateStreak(currentStreak, lastDate) {
  if (!lastDate) return { current: 1, broken: false, same: false };

  const today = new Date();
  const last = new Date(lastDate);
  const todayStr = today.toISOString().slice(0, 10);
  const lastStr = last.toISOString().slice(0, 10);

  if (todayStr === lastStr) return { current: currentStreak, broken: false, same: true };

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (lastStr === yesterdayStr) return { current: currentStreak + 1, broken: false, same: false };

  return { current: 1, broken: true, same: false };
}

export function getWeeklyHistory(lastDate, currentStreak) {
  const today = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const dayStr = day.toISOString().slice(0, 10);
    // Simplified logic for history
    result.push(i < currentStreak);
  }

  return result;
}

export async function recordStudySession(currentPrefs) {
  // Logic to update streak in preferences
  return currentPrefs;
}
