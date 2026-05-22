const { supabaseAdmin } = require('../../config/supabase');

const STREAK_MILESTONES = Object.freeze([
  { days: 3, badgeKey: 'streak_3_first_spark', label: 'First Spark', xp: 25, description: 'Kept a study streak for 3 days.' },
  { days: 7, badgeKey: 'streak_7_weekly_rhythm', label: 'Weekly Rhythm', xp: 50, description: 'Kept a study streak for a full week.' },
  { days: 10, badgeKey: 'streak_10_focus_flame', label: 'Focus Flame', xp: 75, description: 'Reached a 10-day study streak.' },
  { days: 20, badgeKey: 'streak_20_momentum_builder', label: 'Momentum Builder', xp: 150, description: 'Reached a 20-day study streak.' },
  { days: 50, badgeKey: 'streak_50_scholar_streak', label: 'Scholar Streak', xp: 400, description: 'Reached a 50-day study streak.' },
  { days: 100, badgeKey: 'streak_100_century_scholar', label: 'Century Scholar', xp: 1000, description: 'Reached a 100-day study streak.' },
]);

const BADGES = Object.freeze({
  CARD_STARTER: {
    badgeKey: 'flashcard_card_starter',
    label: 'Card Starter',
    xp: 15,
    description: 'Reviewed your first flashcard.',
  },
  QUIZ_STARTER: {
    badgeKey: 'quiz_starter',
    label: 'Quiz Starter',
    xp: 15,
    description: 'Submitted your first quiz attempt.',
  },
  PERFECT_RECALL: {
    badgeKey: 'quiz_perfect_recall',
    label: 'Perfect Recall',
    xp: 50,
    description: 'Scored 100% on a quiz attempt.',
  },
});

function calculateLevel(xpTotal = 0) {
  return Math.floor(Math.sqrt(Math.max(Number(xpTotal) || 0, 0) / 100)) + 1;
}

function buildLevelProgress(xpTotal = 0) {
  const safeXp = Math.max(Number(xpTotal) || 0, 0);
  const level = calculateLevel(safeXp);
  const currentLevelXp = ((level - 1) ** 2) * 100;
  const nextLevelXp = (level ** 2) * 100;
  const xpIntoLevel = Math.max(0, safeXp - currentLevelXp);
  const xpNeeded = Math.max(0, nextLevelXp - safeXp);
  const levelSpan = Math.max(1, nextLevelXp - currentLevelXp);

  return {
    current_level: level,
    next_level: level + 1,
    current_level_xp: currentLevelXp,
    next_level_xp: nextLevelXp,
    xp_into_level: xpIntoLevel,
    xp_needed: xpNeeded,
    percent: Math.max(0, Math.min(100, Math.round((xpIntoLevel / levelSpan) * 100))),
  };
}

function normalizeEventInput(event = {}) {
  const eventType = String(event.eventType || event.event_type || 'reward').trim().toLowerCase();
  const idempotencyKey = String(event.idempotencyKey || event.idempotency_key || '').trim();

  return {
    eventType: /^[a-z0-9_.:-]{1,80}$/.test(eventType) ? eventType : 'reward',
    label: String(event.label || 'Reward').trim().slice(0, 120) || 'Reward',
    xpDelta: Math.max(0, Math.floor(Number(event.xpDelta ?? event.xp_delta ?? 0) || 0)),
    idempotencyKey,
    badgeKey: event.badgeKey || event.badge_key || null,
    badgeLabel: event.badgeLabel || event.badge_label || event.label || null,
    badgeDescription: event.badgeDescription || event.badge_description || null,
    sourceType: event.sourceType || event.source_type || null,
    sourceId: event.sourceId || event.source_id || null,
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {},
  };
}

async function awardGamificationEvent(userId, rawEvent = {}) {
  if (!userId) return null;

  const event = normalizeEventInput(rawEvent);
  if (!event.idempotencyKey) {
    console.error('[GAMIFICATION] Reward skipped because idempotency key is missing.');
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('award_gamification_event', {
      p_user_id: userId,
      p_event_type: event.eventType,
      p_label: event.label,
      p_xp_delta: event.xpDelta,
      p_idempotency_key: event.idempotencyKey,
      p_badge_key: event.badgeKey,
      p_badge_label: event.badgeLabel,
      p_badge_description: event.badgeDescription,
      p_source_type: event.sourceType,
      p_source_id: event.sourceId ? String(event.sourceId) : null,
      p_metadata: event.metadata,
    });

    if (error) throw error;
    return Array.isArray(data) ? data[0] || null : data || null;
  } catch (error) {
    console.error('[GAMIFICATION] Failed to award reward:', error.message);
    return null;
  }
}

async function awardBadgeReward(userId, badge, options = {}) {
  return awardGamificationEvent(userId, {
    eventType: options.eventType || `badge.${badge.badgeKey}`,
    label: badge.label,
    xpDelta: badge.xp,
    idempotencyKey: options.idempotencyKey || `badge:${badge.badgeKey}`,
    badgeKey: badge.badgeKey,
    badgeLabel: badge.label,
    badgeDescription: badge.description,
    sourceType: options.sourceType || null,
    sourceId: options.sourceId || null,
    metadata: {
      ...(options.metadata || {}),
      badge_key: badge.badgeKey,
    },
  });
}

async function awardStudyActivityRewards(userId, activityType, streakResult, options = {}) {
  if (!userId || !streakResult?.last_activity_date) return;

  const activityDate = streakResult.last_activity_date;
  const todayActivityCount = Number(streakResult.today_activity_count || 0);

  if (todayActivityCount === 1) {
    await awardGamificationEvent(userId, {
      eventType: 'daily_study',
      label: 'Daily Study',
      xpDelta: 10,
      idempotencyKey: `daily-study:${activityDate}`,
      sourceType: 'streak',
      sourceId: activityDate,
      metadata: {
        activity_type: activityType,
        activity_date: activityDate,
      },
    });

    const milestone = STREAK_MILESTONES.find((item) => item.days === Number(streakResult.current_count || 0));
    if (milestone) {
      await awardGamificationEvent(userId, {
        eventType: 'streak_milestone',
        label: milestone.label,
        xpDelta: milestone.xp,
        idempotencyKey: `streak-milestone:${milestone.days}`,
        badgeKey: milestone.badgeKey,
        badgeLabel: milestone.label,
        badgeDescription: milestone.description,
        sourceType: 'streak',
        sourceId: String(milestone.days),
        metadata: {
          milestone_days: milestone.days,
          activity_date: activityDate,
        },
      });
    }
  }

  if (activityType === 'flashcard_review') {
    await awardBadgeReward(userId, BADGES.CARD_STARTER, {
      eventType: 'flashcard_starter',
      sourceType: options.sourceType || 'flashcards',
      sourceId: options.sourceId || null,
      metadata: options.metadata,
    });
  }

  if (activityType === 'quiz_attempt') {
    await awardBadgeReward(userId, BADGES.QUIZ_STARTER, {
      eventType: 'quiz_starter',
      sourceType: options.sourceType || 'quiz',
      sourceId: options.sourceId || null,
      metadata: options.metadata,
    });
  }
}

async function awardPerfectQuizReward(userId, quizId, attemptId, percent) {
  if (Number(percent || 0) !== 100) return null;

  return awardBadgeReward(userId, BADGES.PERFECT_RECALL, {
    eventType: 'quiz_perfect_recall',
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
    xp: milestone.xp,
    badge_key: milestone.badgeKey,
    remaining: Math.max(0, milestone.days - current),
  };
}

function normalizeSummaryRow(row) {
  const xpTotal = Math.max(Number(row?.xp_total || 0), 0);
  const level = Math.max(Number(row?.level || calculateLevel(xpTotal)), 1);

  return {
    xp_total: xpTotal,
    level,
    streak_freezes_available: Math.max(Number(row?.streak_freezes_available || 0), 0),
    level_progress: buildLevelProgress(xpTotal),
  };
}

async function getGamificationSummary(userId, streak = null) {
  const [{ data: summary, error: summaryError }, { data: badges, error: badgesError }, { data: events, error: eventsError }] = await Promise.all([
    supabaseAdmin
      .from('user_gamification_summary')
      .select('xp_total, level, streak_freezes_available')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('user_badges')
      .select('badge_key, label, description, metadata, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('gamification_events')
      .select('id, event_type, label, xp_delta, badge_key, badge_label, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (summaryError) throw summaryError;
  if (badgesError) throw badgesError;
  if (eventsError) throw eventsError;

  const normalizedSummary = normalizeSummaryRow(summary);
  const currentStreak = Number(streak?.current || 0);

  return {
    ...normalizedSummary,
    badges: (badges || []).map((badge) => ({
      badge_key: badge.badge_key,
      label: badge.label,
      description: badge.description || '',
      metadata: badge.metadata || {},
      earned_at: badge.earned_at,
    })),
    recent_events: (events || []).map((event) => ({
      id: event.id,
      event_type: event.event_type,
      label: event.label,
      xp_delta: Number(event.xp_delta || 0),
      badge_key: event.badge_key || null,
      badge_label: event.badge_label || null,
      metadata: event.metadata || {},
      created_at: event.created_at,
    })),
    streak,
    next_streak_milestone: getNextStreakMilestone(currentStreak),
  };
}

module.exports = {
  BADGES,
  STREAK_MILESTONES,
  awardBadgeReward,
  awardGamificationEvent,
  awardPerfectQuizReward,
  awardStudyActivityRewards,
  calculateLevel,
  getGamificationSummary,
  getNextStreakMilestone,
};
