import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, CheckCheck, Megaphone, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiRequest } from '../../../config/api';
import PaginationControls from '../../library/components/PaginationControls';
import { notifyUnreadCountChanged } from '../notificationEvents';

const NOTIFICATIONS_PAGE_SIZE = 8;

export default function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const page = Math.max(1, Number(searchParams.get('page') || 1));

  const setNotificationParams = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updateUnreadCount = useCallback((updater) => {
    setUnreadCount((current) => {
      const rawNext = typeof updater === 'function' ? updater(current) : updater;
      const next = Math.max(0, Number(rawNext || 0));
      notifyUnreadCountChanged(next);
      return next;
    });
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(NOTIFICATIONS_PAGE_SIZE),
      });
      const data = await apiRequest(`/api/notifications?${query.toString()}`);
      const pagination = data.pagination || {};
      const nextUnreadCount = Math.max(0, Number(data.unread_count || 0));
      const nextTotalPages = Math.max(1, Number(pagination.totalPages || pagination.total_pages || 1));
      const nextTotalCount = Math.max(0, Number(pagination.totalCount ?? pagination.total_count ?? data.notifications?.length ?? 0));

      setNotifications(data.notifications || []);
      setUnreadCount(nextUnreadCount);
      setTotalPages(nextTotalPages);
      setTotalCount(nextTotalCount);
      notifyUnreadCountChanged(nextUnreadCount);

      if (page > nextTotalPages) {
        setNotificationParams({ page: nextTotalPages > 1 ? String(nextTotalPages) : null });
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, setNotificationParams]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markRead(id) {
    setSaving(true);
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      updateUnreadCount((count) => count - 1);
    } catch (error) {
      toast.error(error.message || 'Could not mark notification read.');
    } finally {
      setSaving(false);
    }
  }

  async function markAllRead() {
    setSaving(true);
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      updateUnreadCount(0);
      toast.success('Notifications marked as read.');
    } catch (error) {
      toast.error(error.message || 'Could not mark notifications read.');
    } finally {
      setSaving(false);
    }
  }

  async function clearNotification(id) {
    const target = notifications.find((item) => item.id === id);
    setSaving(true);
    try {
      await apiRequest(`/api/notifications/${id}/dismiss`, { method: 'POST' });
      setNotifications((current) => current.filter((item) => item.id !== id));
      if (target && !target.read) {
        updateUnreadCount((count) => count - 1);
      }
      setTotalCount((count) => Math.max(0, count - 1));
      toast.success('Notification cleared.');
    } catch (error) {
      toast.error(error.message || 'Could not clear notification.');
    } finally {
      setSaving(false);
    }
  }

  async function clearAllNotifications() {
    setSaving(true);
    try {
      await apiRequest('/api/notifications/dismiss-all', { method: 'POST' });
      setNotifications([]);
      setTotalCount(0);
      setTotalPages(1);
      updateUnreadCount(0);
      setNotificationParams({ page: null });
      toast.success('Notifications cleared.');
    } catch (error) {
      toast.error(error.message || 'Could not clear notifications.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8" aria-busy="true">
        <div className="sharp-skeleton-shimmer h-40 rounded-[2rem] border border-[color:var(--color-border)]" />
        {[0, 1, 2].map((item) => <div key={item} className="sharp-skeleton-shimmer h-28 rounded-[1.5rem] border border-[color:var(--color-border)]" />)}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">Notifications</p>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.5rem)] font-black leading-none text-[color:var(--color-text)]">Announcements & updates</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-text-muted)]">
              Updates from the admin team about website changes, maintenance, and important study workspace notices.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={markAllRead}
              disabled={saving || unreadCount === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 font-black text-[color:var(--color-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck size={18} aria-hidden="true" />
              Mark all read
            </button>
            <button
              type="button"
              onClick={clearAllNotifications}
              disabled={saving || totalCount === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-2.5 font-black text-[color:var(--color-accent-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle size={18} aria-hidden="true" />
              Clear all
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-card sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-surface-2)] text-[color:var(--color-accent)]">
              <Bell size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-[color:var(--color-text)]">Inbox</h2>
              <p className="text-sm text-[color:var(--color-text-muted)]">{unreadCount} unread - {totalCount} total</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {notifications.length ? (
            <>
              {notifications.map((notice) => (
                <article key={notice.id} className={`rounded-[1.5rem] border p-4 transition ${notice.read ? 'border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/60' : 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10'}`}>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[color:var(--color-surface)] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">{notice.category}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${notice.priority === 'high' ? 'bg-rose-500/10 text-rose-500' : 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'}`}>{notice.priority}</span>
                        {!notice.read ? <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-500">New</span> : null}
                      </div>
                      <h3 className="mt-3 text-lg font-black text-[color:var(--color-text)]">{notice.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--color-text-muted)]">{notice.body}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">{formatDateTime(notice.published_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {!notice.read ? (
                        <button
                          type="button"
                          onClick={() => markRead(notice.id)}
                          disabled={saving}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-bold text-[color:var(--color-text)] disabled:opacity-60"
                        >
                          <CheckCheck size={16} aria-hidden="true" />
                          Mark read
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => clearNotification(notice.id)}
                        disabled={saving}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-bold text-[color:var(--color-text-muted)] disabled:opacity-60"
                      >
                        <XCircle size={16} aria-hidden="true" />
                        Clear
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              <PaginationControls
                page={page}
                totalPages={totalPages}
                onChange={(nextPage) => setNotificationParams({ page: nextPage === 1 ? null : String(nextPage) })}
              />
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-10 text-center">
              <Megaphone className="mx-auto text-[color:var(--color-text-muted)]" size={36} aria-hidden="true" />
              <h2 className="mt-3 text-xl font-black text-[color:var(--color-text)]">No notifications yet</h2>
              <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">Published admin announcements will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function formatDateTime(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
