const { supabaseAdmin } = require('../../config/supabase');
const { getCache, setCache } = require('../../utils/cache');
const { sendCachedJson } = require('../../utils/httpCache');
const { dashboardCacheKey } = require('./dashboard.cache');

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

module.exports = { getDashboard };
