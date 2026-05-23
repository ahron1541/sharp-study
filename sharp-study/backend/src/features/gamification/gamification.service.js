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

const DIFFICULTY_LEVELS = Object.freeze({
  easy: {
    key: 'easy',
    label: 'Easy',
    flashcardKnownXp: 1,
    flashcardLearningXp: 1,
    quizBaseXp: 5,
    quizAccuracyBonus: { passing: 2, strong: 4, perfect: 6 },
    timerMultiplier: 1.25,
  },
  normal: {
    key: 'normal',
    label: 'Normal',
    flashcardKnownXp: 2,
    flashcardLearningXp: 1,
    quizBaseXp: 10,
    quizAccuracyBonus: { passing: 3, strong: 6, perfect: 10 },
    timerMultiplier: 1,
  },
  hard: {
    key: 'hard',
    label: 'Hard',
    flashcardKnownXp: 4,
    flashcardLearningXp: 2,
    quizBaseXp: 20,
    quizAccuracyBonus: { passing: 6, strong: 12, perfect: 18 },
    timerMultiplier: 0.8,
  },
  expert: {
    key: 'expert',
    label: 'Expert',
    flashcardKnownXp: 6,
    flashcardLearningXp: 3,
    quizBaseXp: 35,
    quizAccuracyBonus: { passing: 10, strong: 20, perfect: 30 },
    timerMultiplier: 0.6,
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

function normalizeDifficulty(difficulty = 'normal') {
  const key = String(difficulty || 'normal').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_LEVELS, key) ? key : 'normal';
}

function getDifficultyConfig(difficulty = 'normal') {
  return DIFFICULTY_LEVELS[normalizeDifficulty(difficulty)];
}

function getQuizAccuracyBonus(percent = 0, difficultyConfig = DIFFICULTY_LEVELS.normal) {
  const scorePercent = Number(percent || 0);
  if (scorePercent >= 100) {
    return { tier: 'perfect', label: 'Perfect Accuracy Bonus', xp: difficultyConfig.quizAccuracyBonus.perfect };
  }
  if (scorePercent >= 90) {
    return { tier: 'strong', label: 'Strong Accuracy Bonus', xp: difficultyConfig.quizAccuracyBonus.strong };
  }
  if (scorePercent >= 75) {
    return { tier: 'passing', label: 'Passing Accuracy Bonus', xp: difficultyConfig.quizAccuracyBonus.passing };
  }
  return null;
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

function scopeIdempotencyKey(userId, idempotencyKey) {
  const key = String(idempotencyKey || '').trim();
  if (!userId || !key || key.startsWith(`${userId}:`)) return key;
  return `${userId}:${key}`;
}

function getIdempotencyKeyCandidates(userId, idempotencyKey) {
  const scopedKey = scopeIdempotencyKey(userId, idempotencyKey);
  const legacyKey = String(idempotencyKey || '').trim();
  return [...new Set([scopedKey, legacyKey].filter(Boolean))];
}

function normalizeEventRow(row, summary = null, duplicate = false) {
  if (!row) return null;

  return {
    id: row.id,
    event_type: row.event_type,
    label: row.label,
    xp_delta: Number(row.xp_delta || 0),
    badge_key: row.badge_key || null,
    badge_label: row.badge_label || null,
    source_type: row.source_type || null,
    source_id: row.source_id || null,
    metadata: row.metadata || {},
    idempotency_key: row.idempotency_key || '',
    created_at: row.created_at,
    duplicate,
    summary: summary ? normalizeSummaryRow(summary) : null,
  };
}

async function findExistingGamificationEvent(userId, idempotencyKeys = []) {
  const keys = [...new Set((idempotencyKeys || []).filter(Boolean))];
  if (!userId || !keys.length) return null;

  const { data, error } = await supabaseAdmin
    .from('gamification_events')
    .select('id, event_type, label, xp_delta, badge_key, badge_label, source_type, source_id, metadata, idempotency_key, created_at')
    .eq('user_id', userId)
    .in('idempotency_key', keys)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function incrementGamificationSummary(userId, xpDelta = 0) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('user_gamification_summary')
    .select('user_id, xp_total, level, streak_freezes_available')
    .eq('user_id', userId)
    .maybeSingle();

  if (currentError) throw currentError;

  const nextXpTotal = Math.max(0, Number(current?.xp_total || 0) + Math.max(0, Number(xpDelta || 0)));
  const payload = {
    user_id: userId,
    xp_total: nextXpTotal,
    level: calculateLevel(nextXpTotal),
    streak_freezes_available: Math.max(0, Number(current?.streak_freezes_available || 0)),
    updated_at: new Date().toISOString(),
  };

  const { data: summary, error: upsertError } = await supabaseAdmin
    .from('user_gamification_summary')
    .upsert(payload, { onConflict: 'user_id' })
    .select('xp_total, level, streak_freezes_available')
    .single();

  if (upsertError) throw upsertError;
  return summary;
}

async function insertBadgeIfNeeded(userId, event = {}) {
  if (!userId || !event.badgeKey) return null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_key', event.badgeKey)
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.[0]) return existing[0];

  const { data, error } = await supabaseAdmin
    .from('user_badges')
    .insert({
      user_id: userId,
      badge_key: event.badgeKey,
      label: event.badgeLabel || event.label,
      description: event.badgeDescription || null,
      metadata: {
        ...(event.metadata || {}),
        badge_key: event.badgeKey,
      },
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

async function awardGamificationEventDirect(userId, event, idempotencyKeys) {
  const existing = await findExistingGamificationEvent(userId, idempotencyKeys);
  if (existing) return normalizeEventRow(existing, null, true);

  const idempotencyKey = idempotencyKeys[0] || event.idempotencyKey;
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('gamification_events')
    .insert({
      user_id: userId,
      event_type: event.eventType,
      label: event.label,
      xp_delta: event.xpDelta,
      badge_key: event.badgeKey,
      badge_label: event.badgeLabel,
      source_type: event.sourceType,
      source_id: event.sourceId ? String(event.sourceId) : null,
      metadata: event.metadata,
      idempotency_key: idempotencyKey,
    })
    .select('id, event_type, label, xp_delta, badge_key, badge_label, source_type, source_id, metadata, idempotency_key, created_at')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const duplicate = await findExistingGamificationEvent(userId, idempotencyKeys);
      if (duplicate) return normalizeEventRow(duplicate, null, true);
    }
    throw insertError;
  }

  const summary = await incrementGamificationSummary(userId, event.xpDelta);
  await insertBadgeIfNeeded(userId, event);
  return normalizeEventRow(inserted, summary);
}

async function awardGamificationEvent(userId, rawEvent = {}) {
  if (!userId) return null;

  const event = normalizeEventInput(rawEvent);
  if (!event.idempotencyKey) {
    console.error('[GAMIFICATION] Reward skipped because idempotency key is missing.');
    return null;
  }

  const idempotencyKeys = getIdempotencyKeyCandidates(userId, event.idempotencyKey);
  const storageIdempotencyKey = idempotencyKeys[0];

  try {
    const existing = await findExistingGamificationEvent(userId, idempotencyKeys);
    if (existing) return normalizeEventRow(existing, null, true);

    const { data, error } = await supabaseAdmin.rpc('award_gamification_event', {
      p_user_id: userId,
      p_event_type: event.eventType,
      p_label: event.label,
      p_xp_delta: event.xpDelta,
      p_idempotency_key: storageIdempotencyKey,
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
    console.warn('[GAMIFICATION] RPC reward path failed; using direct table fallback:', error.message);
  }

  try {
    return await awardGamificationEventDirect(userId, event, idempotencyKeys);
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

async function awardFlashcardReviewXp(userId, attempt = {}) {
  if (!userId || !attempt?.id) return null;

  const difficultyConfig = getDifficultyConfig(attempt.difficulty);
  const result = attempt.result === 'learning' ? 'learning' : 'known';
  const xpDelta = result === 'known'
    ? difficultyConfig.flashcardKnownXp
    : difficultyConfig.flashcardLearningXp;

  return awardGamificationEvent(userId, {
    eventType: 'flashcard_review_xp',
    label: `${difficultyConfig.label} Flashcard Review`,
    xpDelta,
    idempotencyKey: `flashcard-review-xp:${attempt.id}`,
    sourceType: 'flashcard_attempt',
    sourceId: attempt.id,
    metadata: {
      difficulty: difficultyConfig.key,
      result,
      set_id: attempt.set_id || null,
      card_id: attempt.card_id || null,
      response_ms: Number.isFinite(Number(attempt.response_ms)) ? Number(attempt.response_ms) : null,
    },
  });
}

async function awardQuizAttemptXp(userId, attempt = {}) {
  if (!userId || !attempt?.id) return [];

  const difficultyConfig = getDifficultyConfig(attempt.difficulty);
  const percent = Number(attempt.percent || 0);
  const metadata = {
    quiz_id: attempt.quiz_id || null,
    attempt_id: attempt.id,
    difficulty: difficultyConfig.key,
    percent,
    score: Number(attempt.score || 0),
    total: Number(attempt.total || 0),
    session_type: attempt.session_type === 'practice' ? 'practice' : 'test',
  };

  const awarded = [];
  const baseReward = await awardGamificationEvent(userId, {
    eventType: 'quiz_attempt_xp',
    label: `${difficultyConfig.label} Quiz Complete`,
    xpDelta: difficultyConfig.quizBaseXp,
    idempotencyKey: `quiz-attempt-xp:${attempt.id}`,
    sourceType: 'quiz_attempt',
    sourceId: attempt.id,
    metadata,
  });
  if (baseReward) awarded.push(baseReward);

  const bonus = getQuizAccuracyBonus(percent, difficultyConfig);
  if (bonus?.xp) {
    const bonusReward = await awardGamificationEvent(userId, {
      eventType: 'quiz_accuracy_bonus',
      label: `${difficultyConfig.label} ${bonus.label}`,
      xpDelta: bonus.xp,
      idempotencyKey: `quiz-accuracy-bonus:${attempt.id}:${bonus.tier}`,
      sourceType: 'quiz_attempt',
      sourceId: attempt.id,
      metadata: {
        ...metadata,
        accuracy_tier: bonus.tier,
      },
    });
    if (bonusReward) awarded.push(bonusReward);
  }

  return awarded;
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

async function getDedupedEventXpTotal(userId) {
  const pageSize = 1000;
  let offset = 0;
  let total = 0;
  const seenKeys = new Set();

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('gamification_events')
      .select('idempotency_key, xp_delta')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const rows = data || [];
    for (const row of rows) {
      const key = String(row.idempotency_key || '').trim();
      if (key && seenKeys.has(key)) continue;
      if (key) seenKeys.add(key);
      total += Math.max(0, Number(row.xp_delta || 0));
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return total;
}

async function repairGamificationSummary(userId, summary = null) {
  const eventXpTotal = await getDedupedEventXpTotal(userId);
  const summaryXpTotal = Math.max(0, Number(summary?.xp_total || 0));
  const xpTotal = Math.max(summaryXpTotal, eventXpTotal);
  const level = calculateLevel(xpTotal);

  if (summary && summaryXpTotal === xpTotal && Number(summary.level || 1) === level) {
    return summary;
  }

  const { data, error } = await supabaseAdmin
    .from('user_gamification_summary')
    .upsert({
      user_id: userId,
      xp_total: xpTotal,
      level,
      streak_freezes_available: Math.max(0, Number(summary?.streak_freezes_available || 0)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('xp_total, level, streak_freezes_available')
    .single();

  if (error) throw error;
  return data;
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

  const repairedSummary = await repairGamificationSummary(userId, summary);
  const normalizedSummary = normalizeSummaryRow(repairedSummary);
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
  DIFFICULTY_LEVELS,
  STREAK_MILESTONES,
  awardBadgeReward,
  awardFlashcardReviewXp,
  awardGamificationEvent,
  awardPerfectQuizReward,
  awardQuizAttemptXp,
  awardStudyActivityRewards,
  calculateLevel,
  getGamificationSummary,
  getNextStreakMilestone,
  normalizeDifficulty,
};
