const express = require('express');

const { supabaseAdmin } = require('../../config/supabase');
const { requireAuth } = require('../../middleware/auth.middleware');
const { sanitizePlainText } = require('../../utils/studyGuideSanitize');
const { writeSystemLog } = require('../../utils/systemLog');

const router = express.Router();

router.use(requireAuth);

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 25;
const MAX_VISIBLE_NOTIFICATIONS = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInt(value, fallback, max = 1000) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildPagination(page, pageSize, totalCount) {
  const safeTotal = Number(totalCount || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  return {
    page,
    pageSize,
    page_size: pageSize,
    totalCount: safeTotal,
    total_count: safeTotal,
    totalPages,
    total_pages: totalPages,
  };
}

function isMissingTableError(error) {
  return error?.code === '42P01';
}

function applyVisibleAnnouncementFilters(query, nowIso) {
  return query
    .eq('status', 'published')
    .or([
      'and(starts_at.is.null,ends_at.is.null)',
      `and(starts_at.is.null,ends_at.gte.${nowIso})`,
      `and(starts_at.lte.${nowIso},ends_at.is.null)`,
      `and(starts_at.lte.${nowIso},ends_at.gte.${nowIso})`,
    ].join(','));
}

function isVisibleAnnouncement(announcement) {
  const now = Date.now();
  const startsAt = announcement.starts_at ? new Date(announcement.starts_at).getTime() : null;
  const endsAt = announcement.ends_at ? new Date(announcement.ends_at).getTime() : null;
  return announcement.status === 'published'
    && (!startsAt || startsAt <= now)
    && (!endsAt || endsAt >= now);
}

function normalizeAnnouncement(row, readIds = new Set()) {
  return {
    id: row.id,
    title: sanitizePlainText(row.title || 'Announcement'),
    body: sanitizePlainText(row.body || ''),
    category: row.category || 'general',
    priority: row.priority === 'high' ? 'high' : 'normal',
    published_at: row.updated_at || row.created_at,
    read: readIds.has(row.id),
  };
}

router.get('/', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.limit || req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const nowIso = new Date().toISOString();

    const [
      { data: announcements, error: announcementError },
      { data: reads, error: readError },
      { data: dismissals, error: dismissalError },
    ] = await Promise.all([
      applyVisibleAnnouncementFilters(
        supabaseAdmin
          .from('announcements')
          .select('id, title, body, category, priority, status, starts_at, ends_at, created_at, updated_at'),
        nowIso
      )
        .order('updated_at', { ascending: false })
        .limit(MAX_VISIBLE_NOTIFICATIONS),
      supabaseAdmin
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', req.user.id),
      supabaseAdmin
        .from('announcement_dismissals')
        .select('announcement_id')
        .eq('user_id', req.user.id),
    ]);

    if (isMissingTableError(announcementError) || isMissingTableError(readError)) {
      return res.json({
        notifications: [],
        unread_count: 0,
        pagination: buildPagination(page, pageSize, 0),
      });
    }
    if (announcementError) throw announcementError;
    if (readError) throw readError;
    if (dismissalError && !isMissingTableError(dismissalError)) throw dismissalError;

    const readIds = new Set((reads || []).map((item) => item.announcement_id));
    const dismissedIds = new Set((dismissals || []).map((item) => item.announcement_id));
    const visibleAnnouncements = (announcements || [])
      .filter((item) => !dismissedIds.has(item.id));
    const notifications = visibleAnnouncements
      .slice(from, to + 1)
      .map((item) => normalizeAnnouncement(item, readIds));
    const totalCount = visibleAnnouncements.length;
    const visibleReadCount = visibleAnnouncements
      .filter((item) => readIds.has(item.id))
      .length;
    const unreadCount = Math.max(0, totalCount - visibleReadCount);

    res.json({
      notifications,
      unread_count: unreadCount,
      pagination: buildPagination(page, pageSize, totalCount),
    });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'notifications',
      message: 'Failed to load notifications.',
      metadata: { user_id: req.user.id, error: error.message },
    });
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const announcementId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(announcementId)) {
      return res.status(400).json({ error: 'Invalid notification id.' });
    }

    const { data: existingRead, error: lookupError } = await supabaseAdmin
      .from('announcement_reads')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('announcement_id', announcementId)
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    const readPayload = { read_at: new Date().toISOString() };
    const { error } = existingRead?.id
      ? await supabaseAdmin
        .from('announcement_reads')
        .update(readPayload)
        .eq('id', existingRead.id)
      : await supabaseAdmin
        .from('announcement_reads')
        .insert({
          user_id: req.user.id,
          announcement_id: announcementId,
          ...readPayload,
        });

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'notifications',
      message: 'Failed to mark notification as read.',
      metadata: { user_id: req.user.id, notification_id: req.params.id, error: error.message },
    });
    res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

router.post('/:id/dismiss', async (req, res) => {
  try {
    const announcementId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(announcementId)) {
      return res.status(400).json({ error: 'Invalid notification id.' });
    }

    const { error } = await supabaseAdmin
      .from('announcement_dismissals')
      .upsert({
        user_id: req.user.id,
        announcement_id: announcementId,
        dismissed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,announcement_id' });

    if (isMissingTableError(error)) {
      return res.status(409).json({ error: 'Notification clearing is not configured yet.' });
    }
    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'notifications',
      message: 'Failed to dismiss notification.',
      metadata: { user_id: req.user.id, notification_id: req.params.id, error: error.message },
    });
    res.status(500).json({ error: 'Failed to clear notification.' });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const { data: announcements, error: announcementError } = await applyVisibleAnnouncementFilters(
      supabaseAdmin
        .from('announcements')
        .select('id, status, starts_at, ends_at'),
      nowIso
    )
      .order('updated_at', { ascending: false })
      .limit(MAX_VISIBLE_NOTIFICATIONS);

    if (announcementError?.code === '42P01') {
      return res.json({ success: true, count: 0 });
    }
    if (announcementError) throw announcementError;

    const visibleIds = (announcements || [])
      .filter(isVisibleAnnouncement)
      .map((item) => item.id);
    if (!visibleIds.length) {
      return res.json({ success: true, count: 0 });
    }

    const { data: existingReads, error: readLookupError } = await supabaseAdmin
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', req.user.id)
      .in('announcement_id', visibleIds);

    if (readLookupError?.code === '42P01') {
      return res.json({ success: true, count: 0 });
    }
    if (readLookupError) throw readLookupError;

    const readIds = new Set((existingReads || []).map((item) => item.announcement_id));
    const unreadIds = visibleIds.filter((announcementId) => !readIds.has(announcementId));
    if (!unreadIds.length) {
      return res.json({ success: true, count: visibleIds.length });
    }

    const { error } = await supabaseAdmin
      .from('announcement_reads')
      .insert(
        unreadIds.map((announcementId) => ({
          user_id: req.user.id,
          announcement_id: announcementId,
          read_at: new Date().toISOString(),
        }))
      );

    if (error) throw error;
    res.json({ success: true, count: visibleIds.length });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'notifications',
      message: 'Failed to mark all notifications as read.',
      metadata: { user_id: req.user.id, error: error.message },
    });
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

router.post('/dismiss-all', async (req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const [
      { data: announcements, error: announcementError },
      { data: dismissals, error: dismissalLookupError },
    ] = await Promise.all([
      applyVisibleAnnouncementFilters(
        supabaseAdmin
          .from('announcements')
          .select('id, status, starts_at, ends_at'),
        nowIso
      )
        .order('updated_at', { ascending: false })
        .limit(MAX_VISIBLE_NOTIFICATIONS),
      supabaseAdmin
        .from('announcement_dismissals')
        .select('announcement_id')
        .eq('user_id', req.user.id),
    ]);

    if (isMissingTableError(announcementError)) {
      return res.json({ success: true, count: 0 });
    }
    if (announcementError) throw announcementError;
    if (dismissalLookupError && !isMissingTableError(dismissalLookupError)) throw dismissalLookupError;
    if (isMissingTableError(dismissalLookupError)) {
      return res.status(409).json({ error: 'Notification clearing is not configured yet.' });
    }

    const dismissedIds = new Set((dismissals || []).map((item) => item.announcement_id));
    const visibleIds = (announcements || [])
      .filter(isVisibleAnnouncement)
      .map((item) => item.id)
      .filter((announcementId) => !dismissedIds.has(announcementId));

    if (!visibleIds.length) {
      return res.json({ success: true, count: 0 });
    }

    const dismissedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('announcement_dismissals')
      .upsert(
        visibleIds.map((announcementId) => ({
          user_id: req.user.id,
          announcement_id: announcementId,
          dismissed_at: dismissedAt,
        })),
        { onConflict: 'user_id,announcement_id' }
      );

    if (error) throw error;
    res.json({ success: true, count: visibleIds.length });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'notifications',
      message: 'Failed to dismiss notifications.',
      metadata: { user_id: req.user.id, error: error.message },
    });
    res.status(500).json({ error: 'Failed to clear notifications.' });
  }
});

module.exports = router;
