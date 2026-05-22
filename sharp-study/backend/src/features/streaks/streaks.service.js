const { supabaseAdmin } = require('../../config/supabase');
const { awardStudyActivityRewards } = require('../gamification/gamification.service');

const DEFAULT_STREAK_TIMEZONE = process.env.STREAK_TIMEZONE || 'Asia/Manila';
const ACTIVITY_TYPES = Object.freeze({
  FLASHCARD_REVIEW: 'flashcard_review',
  FLASHCARD_CREATED: 'flashcard_created',
  FLASHCARD_UPDATED: 'flashcard_updated',
  QUIZ_ATTEMPT: 'quiz_attempt',
  QUIZ_CREATED: 'quiz_created',
  QUIZ_UPDATED: 'quiz_updated',
  STUDY_GUIDE_CREATED: 'study_guide_created',
  STUDY_GUIDE_UPDATED: 'study_guide_updated',
  AI_GENERATION: 'ai_generation',
});

function clampDays(value) {
  const days = Number(value) || 35;
  return Math.max(7, Math.min(days, 120));
}

function normalizeActivityType(value) {
  const normalized = String(value || 'study_activity').trim().toLowerCase();
  return /^[a-z0-9_.-]{1,64}$/.test(normalized) ? normalized : 'study_activity';
}

function formatDateKey(date = new Date(), timezone = DEFAULT_STREAK_TIMEZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || DEFAULT_STREAK_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function addDays(dateKey, offset) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function toInteger(value) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
}

async function recordStudyActivity(userId, activityType, options = {}) {
  if (!userId) return null;

  const timezone = options.timezone || DEFAULT_STREAK_TIMEZONE;
  const occurredAt = options.occurredAt || new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin.rpc('record_study_activity', {
      p_user_id: userId,
      p_activity_type: normalizeActivityType(activityType),
      p_occurred_at: occurredAt,
      p_timezone: timezone,
    });

    if (error) throw error;
    const streakResult = Array.isArray(data) ? data[0] || null : data || null;
    if (streakResult) {
      await awardStudyActivityRewards(userId, normalizeActivityType(activityType), streakResult, options);
    }
    return streakResult;
  } catch (error) {
    console.error('[STREAKS] Failed to record study activity:', error.message);
    if (options.throwOnError) throw error;
    return null;
  }
}

async function getStudyStreak(userId, options = {}) {
  const days = clampDays(options.days);
  const [{ data: summary, error: summaryError }, { data: rows, error: rowsError }] = await Promise.all([
    supabaseAdmin
      .from('user_streaks')
      .select('current_count, longest_count, last_activity_date, timezone')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('study_activity_days')
      .select('activity_date, activity_count, activity_counts')
      .eq('user_id', userId)
      .order('activity_date', { ascending: false })
      .limit(days),
  ]);

  if (summaryError) throw summaryError;
  if (rowsError) throw rowsError;

  const timezone = summary?.timezone || DEFAULT_STREAK_TIMEZONE;
  const today = formatDateKey(new Date(), timezone);
  const yesterday = addDays(today, -1);
  const lastActivityDate = summary?.last_activity_date || null;
  const streakStillAlive = lastActivityDate === today || lastActivityDate === yesterday;
  const history = (rows || [])
    .map((row) => ({
      date: row.activity_date,
      activity_count: toInteger(row.activity_count),
      activity_counts: row.activity_counts && typeof row.activity_counts === 'object' ? row.activity_counts : {},
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    current: streakStillAlive ? toInteger(summary?.current_count) : 0,
    longest: toInteger(summary?.longest_count),
    last_activity_date: lastActivityDate,
    today_active: history.some((row) => row.date === today),
    timezone,
    history,
  };
}

module.exports = {
  ACTIVITY_TYPES,
  DEFAULT_STREAK_TIMEZONE,
  getStudyStreak,
  recordStudyActivity,
};
