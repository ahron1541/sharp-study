const { supabaseAdmin } = require('../../config/supabase');
const { writeSystemLog } = require('../../utils/systemLog');

const DEFAULT_AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 10);
const DEFAULT_WINDOW_HOURS = 24;

function relationMissing(error) {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');
}

function cleanFeature(value = '') {
  const feature = String(value || 'generation').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
  return feature || 'generation';
}

function inferFeature(req) {
  const path = String(req.path || req.originalUrl || '').toLowerCase();
  if (path.includes('flashcards')) return 'flashcards';
  if (path.includes('quiz')) return 'quiz';
  return 'materials';
}

function windowStartIso(windowHours = DEFAULT_WINDOW_HOURS) {
  const hours = Math.max(1, Math.min(Number(windowHours) || DEFAULT_WINDOW_HOURS, 168));
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function getAiRateLimitForUser(userId) {
  try {
    const [{ data: settings, error: settingsError }, { data: override, error: overrideError }] = await Promise.all([
      supabaseAdmin
        .from('ai_rate_limit_settings')
        .select('daily_limit, window_hours')
        .eq('id', 'global')
        .maybeSingle(),
      supabaseAdmin
        .from('ai_rate_limit_overrides')
        .select('daily_limit, is_enabled')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (settingsError && !relationMissing(settingsError)) throw settingsError;
    if (overrideError && !relationMissing(overrideError)) throw overrideError;

    const globalLimit = Math.max(1, Number(settings?.daily_limit || DEFAULT_AI_DAILY_LIMIT));
    const windowHours = Math.max(1, Number(settings?.window_hours || DEFAULT_WINDOW_HOURS));
    const overrideLimit = override?.is_enabled ? Number(override.daily_limit) : 0;

    return {
      dailyLimit: overrideLimit > 0 ? overrideLimit : globalLimit,
      windowHours,
      source: overrideLimit > 0 ? 'user_override' : 'global',
    };
  } catch (error) {
    if (!relationMissing(error)) {
      await writeSystemLog({
        level: 'warning',
        source: 'ai.rate_limit',
        message: 'Falling back to default AI rate limit settings.',
        metadata: { error: error.message },
      });
    }

    return {
      dailyLimit: Math.max(1, DEFAULT_AI_DAILY_LIMIT),
      windowHours: DEFAULT_WINDOW_HOURS,
      source: 'fallback',
    };
  }
}

async function countAiRequests(userId, windowHours) {
  try {
    const { count, error } = await supabaseAdmin
      .from('ai_request_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStartIso(windowHours))
      .in('status', ['queued', 'completed']);

    if (error) throw error;
    return Number(count || 0);
  } catch (error) {
    if (!relationMissing(error)) {
      await writeSystemLog({
        level: 'warning',
        source: 'ai.rate_limit',
        message: 'Could not count AI request events; allowing request with fallback behavior.',
        metadata: { user_id: userId, error: error.message },
      });
    }
    return 0;
  }
}

async function recordAiRequestEvent(userId, feature, status = 'queued', metadata = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_request_events')
      .insert({
        user_id: userId,
        feature: cleanFeature(feature),
        status,
        provider: metadata.provider || null,
        metadata,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    if (!relationMissing(error)) {
      await writeSystemLog({
        level: 'warning',
        source: 'ai.events',
        message: 'Failed to record AI request event.',
        metadata: { user_id: userId, feature, status, error: error.message },
      });
    }
    return null;
  }
}

async function updateAiRequestEvent(eventId, status, metadata = {}) {
  if (!eventId) return;

  try {
    const { error } = await supabaseAdmin
      .from('ai_request_events')
      .update({
        status,
        metadata,
      })
      .eq('id', eventId);

    if (error) throw error;
  } catch (error) {
    if (!relationMissing(error)) {
      await writeSystemLog({
        level: 'warning',
        source: 'ai.events',
        message: 'Failed to update AI request event.',
        metadata: { event_id: eventId, status, error: error.message },
      });
    }
  }
}

async function aiDailyLimit(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user.' });
    }

    const settings = await getAiRateLimitForUser(userId);
    const used = await countAiRequests(userId, settings.windowHours);

    if (used >= settings.dailyLimit) {
      return res.status(429).json({
        error: `AI generation limit reached. You can generate ${settings.dailyLimit} time${settings.dailyLimit === 1 ? '' : 's'} every ${settings.windowHours} hours.`,
        limit: settings.dailyLimit,
        used,
        window_hours: settings.windowHours,
      });
    }

    const feature = inferFeature(req);
    req.aiUsage = {
      feature,
      eventId: await recordAiRequestEvent(userId, feature, 'queued', {
        path: req.originalUrl,
        limit: settings.dailyLimit,
        used_before_request: used,
        window_hours: settings.windowHours,
        limit_source: settings.source,
      }),
    };

    return next();
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'ai.rate_limit',
      message: 'AI rate limit check failed.',
      metadata: { error: error.message },
    });
    return res.status(500).json({ error: 'Could not check AI generation limit.' });
  }
}

module.exports = {
  aiDailyLimit,
  getAiRateLimitForUser,
  recordAiRequestEvent,
  updateAiRequestEvent,
};
