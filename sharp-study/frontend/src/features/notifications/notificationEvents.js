export const NOTIFICATION_UNREAD_COUNT_CHANGED = 'sharp-study-notification-unread-count-changed';

export function notifyUnreadCountChanged(unreadCount) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(NOTIFICATION_UNREAD_COUNT_CHANGED, {
    detail: { unreadCount: Math.max(0, Number(unreadCount || 0)) },
  }));
}
