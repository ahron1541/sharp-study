const { supabaseAdmin } = require('../../config/supabase');
const { getCache, setCache } = require('../../utils/cache');
const { sendCachedJson } = require('../../utils/httpCache');
const { dashboardCacheKey } = require('./dashboard.cache');

const RECENT_CONTENT_TYPES = new Set(['study_guide', 'flashcards', 'quiz']);
const RECENT_LIMIT_DEFAULT = 3;
const RECENT_LIMIT_MAX = 12;
const RECENT_KEEP_COUNT = 12;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRecentLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return RECENT_LIMIT_DEFAULT;
  return Math.min(parsed, RECENT_LIMIT_MAX);
}

function sanitizeTitle(value) {
  return String(value || 'Untitled material')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'Untitled material';
}

async function getDashboard(req, res) {
  try {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const key = dashboardCacheKey(userId, limit);
    const cached = getCache(key);

    if (cached) {
      return sendCachedJson(req, res, cached.payload, {
        lastModified: cached.lastModified,
        cacheControl: 'private, max-age=30, must-revalidate',
      });
    }

    const [guidesRes, cardsRes, quizzesRes] = await Promise.all([
      supabaseAdmin
        .from('study_guides')
        .select('id, title, created_at, document_id')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('flashcard_sets')
        .select('id, title, created_at, document_id')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('quizzes')
        .select('id, title, created_at, document_id')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (guidesRes.error) throw guidesRes.error;
    if (cardsRes.error) throw cardsRes.error;
    if (quizzesRes.error) throw quizzesRes.error;

    const payload = {
      items: {
        study_guides: guidesRes.data || [],
        flashcards: cardsRes.data || [],
        quizzes: quizzesRes.data || [],
      },
    };

    const newestDate = [
      ...payload.items.study_guides,
      ...payload.items.flashcards,
      ...payload.items.quizzes,
    ].map((item) => item.created_at).sort().pop();

    const lastModified = newestDate || new Date().toISOString();
    setCache(key, { payload, lastModified }, 45);

    return sendCachedJson(req, res, payload, {
      lastModified,
      cacheControl: 'private, max-age=30, must-revalidate',
    });
  } catch (error) {
    console.error('Dashboard cache read failed:', error);
    return res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
}

async function getRecentMaterials(req, res) {
  try {
    const limit = parseRecentLimit(req.query.limit);
    const { data, error } = await supabaseAdmin
      .from('user_recent_materials')
      .select('id, content_type, content_id, title, opened_at')
      .eq('user_id', req.user.id)
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (error?.code === '42P01') {
      return res.json({ items: [] });
    }
    if (error) throw error;

    return res.json({ items: data || [] });
  } catch (error) {
    console.error('Recent materials read failed:', error);
    return res.status(500).json({ error: 'Failed to load recent files.' });
  }
}

async function recordRecentMaterial(req, res) {
  try {
    const contentType = String(req.body?.content_type || '').trim();
    const contentId = String(req.body?.content_id || '').trim();
    const title = sanitizeTitle(req.body?.title);

    if (!RECENT_CONTENT_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Invalid material type.' });
    }
    if (!UUID_PATTERN.test(contentId)) {
      return res.status(400).json({ error: 'Invalid material id.' });
    }

    const openedAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('user_recent_materials')
      .upsert({
        user_id: req.user.id,
        content_type: contentType,
        content_id: contentId,
        title,
        opened_at: openedAt,
      }, { onConflict: 'user_id,content_type,content_id' })
      .select('id, content_type, content_id, title, opened_at')
      .single();

    if (error?.code === '42P01') {
      return res.status(409).json({ error: 'Recent files are not configured yet.' });
    }
    if (error) throw error;

    const { data: staleRows, error: staleLookupError } = await supabaseAdmin
      .from('user_recent_materials')
      .select('id')
      .eq('user_id', req.user.id)
      .order('opened_at', { ascending: false })
      .range(RECENT_KEEP_COUNT, 1000);

    if (staleLookupError) throw staleLookupError;
    const staleIds = (staleRows || []).map((row) => row.id);
    if (staleIds.length) {
      const { error: deleteError } = await supabaseAdmin
        .from('user_recent_materials')
        .delete()
        .in('id', staleIds);
      if (deleteError) throw deleteError;
    }

    return res.json({ success: true, item: data });
  } catch (error) {
    console.error('Recent material write failed:', error);
    return res.status(500).json({ error: 'Failed to save recent file.' });
  }
}

module.exports = { getDashboard, getRecentMaterials, recordRecentMaterial };
