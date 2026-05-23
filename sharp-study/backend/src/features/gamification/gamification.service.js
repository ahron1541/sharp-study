const { supabaseAdmin } = require('../../config/supabase');

const STREAK_MILESTONES = Object.freeze([
  { days: 3, badgeKey: 'streak_3_first_spark', label: 'First Spark', description: 'Kept a study streak for 3 days.' },
  { days: 7, badgeKey: 'streak_7_weekly_rhythm', label: 'Weekly Rhythm', description: 'Kept a study streak for a full week.' },
  { days: 10, badgeKey: 'streak_10_focus_flame', label: 'Focus Flame', description: 'Reached a 10-day study streak.' },
  { days: 20, badgeKey: 'streak_20_momentum_builder', label: 'Momentum Builder', description: 'Reached a 20-day study streak.' },
  { days: 50, badgeKey: 'streak_50_scholar_streak', label: 'Scholar Streak', description: 'Reached a 50-day study streak.' },
  { days: 100, badgeKey: 'streak_100_century_scholar', label: 'Century Scholar', description: 'Reached a 100-day study streak.' },
]);

const BADGES = Object.freeze({
  CARD_STARTER: {
    badgeKey: 'flashcard_card_starter',
    label: 'Card Starter',
    description: 'Reviewed your first flashcard.',
  },
  QUIZ_STARTER: {
    badgeKey: 'quiz_starter',
    label: 'Quiz Starter',
    description: 'Submitted your first quiz attempt.',
  },
  PERFECT_RECALL: {
    badgeKey: 'quiz_perfect_recall',
    label: 'Perfect Recall',
    description: 'Scored 100% on a quiz attempt.',
  },
});

const DIFFICULTY_LEVELS = Object.freeze({
  easy: { key: 'easy', label: 'Easy', timerMultiplier: 1.25 },
  normal: { key: 'normal', label: 'Normal', timerMultiplier: 1 },
  hard: { key: 'hard', label: 'Hard', timerMultiplier: 0.8 },
  expert: { key: 'expert', label: 'Expert', timerMultiplier: 0.6 },
});

function normalizeDifficulty(difficulty = 'normal') {
  const key = String(difficulty || 'normal').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_LEVELS, key) ? key : 'normal';
}

async function awardBadgeReward(userId, badge, options = {}) {
  if (!userId || !badge?.badgeKey) return null;

  try {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_badges')
      .select('id, badge_key, label, description, metadata, earned_at')
      .eq('user_id', userId)
      .eq('badge_key', badge.badgeKey)
      .order('earned_at', { ascending: true })
      .limit(1);

    if (existingError) throw existingError;
    if (existing?.[0]) return existing[0];

    const { data, error } = await supabaseAdmin
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_key: badge.badgeKey,
        label: badge.label,
        description: badge.description || null,
        metadata: {
          ...(options.metadata || {}),
          badge_key: badge.badgeKey,
          source_type: options.sourceType || null,
          source_id: options.sourceId || null,
        },
      })
      .select('id, badge_key, label, description, metadata, earned_at')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[ACHIEVEMENTS] Failed to award badge:', error.message);
    return null;
  }
}

async function awardStudyActivityRewards(userId, activityType, streakResult, options = {}) {
  if (!userId || !streakResult?.last_activity_date) return;

  const todayActivityCount = Number(streakResult.today_activity_count || 0);

  if (todayActivityCount === 1) {
    const milestone = STREAK_MILESTONES.find((item) => item.days === Number(streakResult.current_count || 0));
    if (milestone) {
      await awardBadgeReward(userId, milestone, {
        sourceType: 'streak',
        sourceId: String(milestone.days),
        metadata: {
          milestone_days: milestone.days,
          activity_date: streakResult.last_activity_date,
          activity_type: activityType,
        },
      });
    }
  }

  if (activityType === 'flashcard_review') {
    await awardBadgeReward(userId, BADGES.CARD_STARTER, {
      sourceType: options.sourceType || 'flashcards',
      sourceId: options.sourceId || null,
      metadata: options.metadata,
    });
  }

  if (activityType === 'quiz_attempt') {
    await awardBadgeReward(userId, BADGES.QUIZ_STARTER, {
      sourceType: options.sourceType || 'quiz',
      sourceId: options.sourceId || null,
      metadata: options.metadata,
    });
  }
}

async function awardPerfectQuizReward(userId, quizId, attemptId, percent) {
  if (Number(percent || 0) !== 100) return null;

  return awardBadgeReward(userId, BADGES.PERFECT_RECALL, {
    sourceType: 'quiz_attempt',
    sourceId: attemptId || quizId || null,
    metadata: {
      quiz_id: quizId || null,
      attempt_id: attemptId || null,
      percent: Number(percent || 0),
    },
  });
}

function getNextStreakMilestone(currentStreak = 0) {
  const current = Number(currentStreak || 0);
  const milestone = STREAK_MILESTONES.find((item) => current < item.days) || null;
  if (!milestone) return null;

  return {
    days: milestone.days,
    label: milestone.label,
    badge_key: milestone.badgeKey,
    remaining: Math.max(0, milestone.days - current),
  };
}

async function getGamificationSummary(userId, streak = null) {
  const { data: badges, count: badgeCount, error: badgesError } = await supabaseAdmin
    .from('user_badges')
    .select('badge_key, label, description, metadata, earned_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
    .limit(20);

  if (badgesError) throw badgesError;

  const normalizedBadges = (badges || []).map((badge) => ({
    badge_key: badge.badge_key,
    label: badge.label,
    description: badge.description || '',
    metadata: badge.metadata || {},
    earned_at: badge.earned_at,
  }));
  const currentStreak = Number(streak?.current || 0);

  return {
    badges: normalizedBadges,
    recent_badges: normalizedBadges.slice(0, 5),
    badge_count: Number(badgeCount ?? normalizedBadges.length),
    streak,
    next_streak_milestone: getNextStreakMilestone(currentStreak),
  };
}

module.exports = {
  BADGES,
  DIFFICULTY_LEVELS,
  STREAK_MILESTONES,
  awardBadgeReward,
  awardPerfectQuizReward,
  awardStudyActivityRewards,
  getGamificationSummary,
  getNextStreakMilestone,
  normalizeDifficulty,
};
