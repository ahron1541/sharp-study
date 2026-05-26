const express = require('express');

const { supabaseAdmin } = require('../../config/supabase');
const { requireAuth } = require('../../middleware/auth.middleware');
const { sanitizePlainText } = require('../../utils/studyGuideSanitize');
const { writeSystemLog } = require('../../utils/systemLog');

const router = express.Router();

router.use(requireAuth);

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
    const [{ data: announcements, error: announcementError }, { data: reads, error: readError }] = await Promise.all([
      supabaseAdmin
        .from('announcements')
        .select('id, title, body, category, priority, status, starts_at, ends_at, created_at, updated_at')
        .in('status', ['published'])
        .order('updated_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', req.user.id),
    ]);

    if (announcementError?.code === '42P01' || readError?.code === '42P01') {
      return res.json({ notifications: [], unread_count: 0 });
    }
    if (announcementError) throw announcementError;
    if (readError) throw readError;

    const readIds = new Set((reads || []).map((item) => item.announcement_id));
    const notifications = (announcements || [])
      .filter(isVisibleAnnouncement)
      .map((item) => normalizeAnnouncement(item, readIds));

    res.json({
      notifications,
      unread_count: notifications.filter((item) => !item.read).length,
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
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(announcementId)) {
      return res.status(400).json({ error: 'Invalid notification id.' });
    }

    const { error } = await supabaseAdmin
      .from('announcement_reads')
      .upsert({
        user_id: req.user.id,
        announcement_id: announcementId,
        read_at: new Date().toISOString(),
      }, { onConflict: 'user_id,announcement_id' });

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

router.post('/read-all', async (req, res) => {
  try {
    const { data: announcements, error: announcementError } = await supabaseAdmin
      .from('announcements')
      .select('id, status, starts_at, ends_at')
      .eq('status', 'published')
      .limit(100);

    if (announcementError?.code === '42P01') {
      return res.json({ success: true, count: 0 });
    }
    if (announcementError) throw announcementError;

    const visibleIds = (announcements || []).filter(isVisibleAnnouncement).map((item) => item.id);
    if (!visibleIds.length) {
      return res.json({ success: true, count: 0 });
    }

    const { error } = await supabaseAdmin
      .from('announcement_reads')
      .upsert(
        visibleIds.map((announcementId) => ({
          user_id: req.user.id,
          announcement_id: announcementId,
          read_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,announcement_id' }
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

module.exports = router;
