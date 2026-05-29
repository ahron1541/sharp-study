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
const REPORT_NOTIFICATION_PREFIX = 'report_';
const REPORT_NOTIFICATION_STATUSES = ['reviewing', 'resolved'];
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
    source: 'announcement',
    title: sanitizePlainText(row.title || 'Announcement'),
    body: sanitizePlainText(row.body || ''),
    category: row.category || 'general',
    priority: row.priority === 'high' ? 'high' : 'normal',
    published_at: row.updated_at || row.created_at,
    read: readIds.has(row.id),
  };
}

function reportStatusLabel(status) {
  if (status === 'open') return 'Open';
  if (status === 'reviewing') return 'Under review';
  if (status === 'resolved') return 'Resolved';
  if (status === 'dismissed') return 'Dismissed';
  return sanitizePlainText(status || 'Updated');
}

function hasAdminResponse(report) {
  return Boolean(String(report?.admin_notes || '').trim());
}

function isReportNotificationEligible(report) {
  return REPORT_NOTIFICATION_STATUSES.includes(report?.status) || hasAdminResponse(report);
}

function reportNotificationTitle(status, hasResponse = false) {
  if (hasResponse) return 'Admin responded to your feedback';
  if (status === 'reviewing') return 'Your feedback is under review';
  if (status === 'resolved') return 'Your feedback was resolved';
  return 'Your feedback was updated';
}

function notificationTime(value) {
  const time = new Date(value || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

function parseReportNotificationId(value) {
  const notificationId = String(value || '').trim();
  if (!notificationId.startsWith(REPORT_NOTIFICATION_PREFIX)) return null;
  const reportId = notificationId.slice(REPORT_NOTIFICATION_PREFIX.length);
  return UUID_PATTERN.test(reportId) ? reportId : null;
}

function normalizePreferences(preferences) {
  return preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
}

function getReportNotificationPrefs(preferences) {
  const normalized = normalizePreferences(preferences);
  const reportNotifications = normalizePreferences(normalized.report_notifications);
  return {
    read: normalizePreferences(reportNotifications.read),
    dismissed: normalizePreferences(reportNotifications.dismissed),
  };
}

function isStoredVersionCurrent(storedVersion, currentVersion) {
  if (!storedVersion || !currentVersion) return false;
  return notificationTime(storedVersion) >= notificationTime(currentVersion);
}

function normalizeReportNotification(row, prefs) {
  const version = row.updated_at || row.resolved_at || row.created_at;
  const contentTitle = sanitizePlainText(row.content_title || 'reported content');
  const adminMessage = sanitizePlainText(row.admin_notes || '');
  const statusLabel = reportStatusLabel(row.status);
  const fallbackBody = `Your report for "${contentTitle}" is ${statusLabel.toLowerCase()}.`;

  return {
    id: `${REPORT_NOTIFICATION_PREFIX}${row.id}`,
    source: 'feedback_report',
    report_id: row.id,
    title: reportNotificationTitle(row.status, Boolean(adminMessage)),
    body: adminMessage ? `Admin response: ${adminMessage}` : fallbackBody,
    category: 'feedback',
    priority: row.status === 'reviewing' ? 'high' : 'normal',
    status: row.status,
    status_label: statusLabel,
    content_title: contentTitle,
    content_type: row.content_type,
    reason: row.reason,
    published_at: version,
    read: isStoredVersionCurrent(prefs.read[row.id], version),
  };
}

async function loadUserPreferences(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return normalizePreferences(data?.preferences);
}

async function saveReportNotificationPrefs(userId, preferences, reportPrefs) {
  const currentPreferences = normalizePreferences(preferences);
  const currentReportNotifications = normalizePreferences(currentPreferences.report_notifications);
  const nextPreferences = {
    ...currentPreferences,
    report_notifications: {
      ...currentReportNotifications,
      read: reportPrefs.read,
      dismissed: reportPrefs.dismissed,
    },
  };

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ preferences: nextPreferences })
    .eq('id', userId);

  if (error) throw error;
  return nextPreferences;
}

async function fetchReportNotificationRows(userId) {
  const { data, error } = await supabaseAdmin
    .from('ai_content_reports')
    .select('id, user_id, content_title, content_type, reason, status, admin_notes, created_at, updated_at, resolved_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(MAX_VISIBLE_NOTIFICATIONS);

  if (isMissingTableError(error)) return [];
  if (error) throw error;
  return (data || []).filter(isReportNotificationEligible);
}

function visibleReportRows(rows, prefs) {
  return (rows || []).filter((row) => {
    const version = row.updated_at || row.resolved_at || row.created_at;
    return !isStoredVersionCurrent(prefs.dismissed[row.id], version);
  });
}

async function markReportNotification(userId, reportId, bucket) {
  const { data: report, error } = await supabaseAdmin
    .from('ai_content_reports')
    .select('id, user_id, status, admin_notes, updated_at, resolved_at, created_at')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle();

  if (isMissingTableError(error)) {
    return { notFound: true };
  }
  if (error) throw error;
  if (!report || !isReportNotificationEligible(report)) {
    return { notFound: true };
  }

  const preferences = await loadUserPreferences(userId);
  const reportPrefs = getReportNotificationPrefs(preferences);
  reportPrefs[bucket][report.id] = report.updated_at || report.resolved_at || report.created_at || new Date().toISOString();
  await saveReportNotificationPrefs(userId, preferences, reportPrefs);
  return { success: true };
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
      reportRows,
      preferences,
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
      fetchReportNotificationRows(req.user.id),
      loadUserPreferences(req.user.id),
    ]);

    if (announcementError && !isMissingTableError(announcementError)) throw announcementError;
    if (readError && !isMissingTableError(readError)) throw readError;
    if (dismissalError && !isMissingTableError(dismissalError)) throw dismissalError;

    const readIds = new Set((reads || []).map((item) => item.announcement_id));
    const dismissedIds = new Set((dismissals || []).map((item) => item.announcement_id));
    const visibleAnnouncements = (isMissingTableError(announcementError) ? [] : announcements || [])
      .filter((item) => !dismissedIds.has(item.id));
    const reportPrefs = getReportNotificationPrefs(preferences);
    const reportNotifications = visibleReportRows(reportRows, reportPrefs)
      .map((item) => normalizeReportNotification(item, reportPrefs));
    const allNotifications = [
      ...visibleAnnouncements.map((item) => normalizeAnnouncement(item, readIds)),
      ...reportNotifications,
    ].sort((a, b) => notificationTime(b.published_at) - notificationTime(a.published_at));
    const notifications = allNotifications.slice(from, to + 1);
    const totalCount = allNotifications.length;
    const unreadCount = allNotifications.filter((item) => !item.read).length;

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
    const notificationId = String(req.params.id || '').trim();
    const reportId = parseReportNotificationId(notificationId);
    if (reportId) {
      const result = await markReportNotification(req.user.id, reportId, 'read');
      if (result.notFound) {
        return res.status(404).json({ error: 'Notification not found.' });
      }
      return res.json({ success: true });
    }

    const announcementId = notificationId;
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
    const notificationId = String(req.params.id || '').trim();
    const reportId = parseReportNotificationId(notificationId);
    if (reportId) {
      const result = await markReportNotification(req.user.id, reportId, 'dismissed');
      if (result.notFound) {
        return res.status(404).json({ error: 'Notification not found.' });
      }
      return res.json({ success: true });
    }

    const announcementId = notificationId;
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
    const [
      { data: announcements, error: announcementError },
      reportRows,
      preferences,
    ] = await Promise.all([
      applyVisibleAnnouncementFilters(
        supabaseAdmin
          .from('announcements')
          .select('id, status, starts_at, ends_at'),
        nowIso
      )
        .order('updated_at', { ascending: false })
        .limit(MAX_VISIBLE_NOTIFICATIONS),
      fetchReportNotificationRows(req.user.id),
      loadUserPreferences(req.user.id),
    ]);

    if (announcementError && !isMissingTableError(announcementError)) throw announcementError;

    const visibleIds = (isMissingTableError(announcementError) ? [] : announcements || [])
      .filter(isVisibleAnnouncement)
      .map((item) => item.id);
    let markedAnnouncementCount = visibleIds.length;

    if (visibleIds.length) {
      const { data: existingReads, error: readLookupError } = await supabaseAdmin
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', req.user.id)
        .in('announcement_id', visibleIds);

      if (isMissingTableError(readLookupError)) {
        markedAnnouncementCount = 0;
      } else {
        if (readLookupError) throw readLookupError;

        const readIds = new Set((existingReads || []).map((item) => item.announcement_id));
        const unreadIds = visibleIds.filter((announcementId) => !readIds.has(announcementId));
        if (unreadIds.length) {
          const { error } = await supabaseAdmin
            .from('announcement_reads')
            .insert(
              unreadIds.map((announcementId) => ({
                user_id: req.user.id,
                announcement_id: announcementId,
                read_at: nowIso,
              }))
            );

          if (error) throw error;
        }
      }
    }

    const reportPrefs = getReportNotificationPrefs(preferences);
    const reportsToMark = visibleReportRows(reportRows, reportPrefs);
    reportsToMark.forEach((report) => {
      reportPrefs.read[report.id] = report.updated_at || report.resolved_at || report.created_at || nowIso;
    });

    if (reportsToMark.length) {
      await saveReportNotificationPrefs(req.user.id, preferences, reportPrefs);
    }

    res.json({ success: true, count: markedAnnouncementCount + reportsToMark.length });
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
      reportRows,
      preferences,
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
      fetchReportNotificationRows(req.user.id),
      loadUserPreferences(req.user.id),
    ]);

    if (announcementError && !isMissingTableError(announcementError)) throw announcementError;
    if (dismissalLookupError && !isMissingTableError(dismissalLookupError)) throw dismissalLookupError;

    const dismissedIds = new Set((dismissals || []).map((item) => item.announcement_id));
    const canDismissAnnouncements = !isMissingTableError(announcementError) && !isMissingTableError(dismissalLookupError);
    const visibleIds = (isMissingTableError(announcementError) ? [] : announcements || [])
      .filter(isVisibleAnnouncement)
      .map((item) => item.id)
      .filter((announcementId) => !dismissedIds.has(announcementId));
    let dismissedAnnouncementCount = 0;

    if (visibleIds.length && canDismissAnnouncements) {
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
      dismissedAnnouncementCount = visibleIds.length;
    }

    const reportPrefs = getReportNotificationPrefs(preferences);
    const reportsToDismiss = visibleReportRows(reportRows, reportPrefs);
    reportsToDismiss.forEach((report) => {
      reportPrefs.dismissed[report.id] = report.updated_at || report.resolved_at || report.created_at || new Date().toISOString();
    });

    if (reportsToDismiss.length) {
      await saveReportNotificationPrefs(req.user.id, preferences, reportPrefs);
    }

    if (visibleIds.length && !canDismissAnnouncements && !reportsToDismiss.length) {
      return res.status(409).json({ error: 'Notification clearing is not configured yet.' });
    }

    res.json({ success: true, count: dismissedAnnouncementCount + reportsToDismiss.length });
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
