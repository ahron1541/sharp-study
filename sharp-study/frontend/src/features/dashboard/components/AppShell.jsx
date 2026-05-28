import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar  from './TopBar';
import { apiRequest } from '../../../config/api';
import { useAuth } from '../../auth/context/AuthContext';
import { NOTIFICATION_UNREAD_COUNT_CHANGED } from '../../notifications/notificationEvents';
import { fetchRecentMaterials, RECENT_MATERIALS_CHANGED } from '../services/recentMaterials';

const COLLAPSED_KEY = 'sharp-study-sidebar-collapsed';

/**
 * AppShell — the persistent layout for all post-login pages.
 * Renders: Sidebar + TopBar + <Outlet /> (the active page).
 */
export default function AppShell() {
  const { profile } = useAuth();
  const [collapsed, setCollapsed]     = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [recentMaterials, setRecentMaterials] = useState([]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setIsMobile(window.innerWidth < 768);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!profile?.id) {
      setNotificationUnreadCount(0);
      setRecentMaterials([]);
      return undefined;
    }

    let mounted = true;
    apiRequest('/api/notifications?limit=1')
      .then((data) => {
        if (!mounted) return;
        setNotificationUnreadCount(Math.max(0, Number(data.unread_count || 0)));
      })
      .catch(() => {
        if (mounted) setNotificationUnreadCount(0);
      });

    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setRecentMaterials([]);
      return undefined;
    }

    let mounted = true;
    const loadRecent = () => {
      fetchRecentMaterials(3)
        .then((data) => {
          if (mounted) setRecentMaterials(data.items || []);
        })
        .catch(() => {
          if (mounted) setRecentMaterials([]);
        });
    };

    loadRecent();
    window.addEventListener(RECENT_MATERIALS_CHANGED, loadRecent);
    return () => {
      mounted = false;
      window.removeEventListener(RECENT_MATERIALS_CHANGED, loadRecent);
    };
  }, [profile?.id]);

  useEffect(() => {
    const handleUnreadCountChange = (event) => {
      setNotificationUnreadCount(Math.max(0, Number(event.detail?.unreadCount || 0)));
    };

    window.addEventListener(NOTIFICATION_UNREAD_COUNT_CHANGED, handleUnreadCountChange);
    return () => window.removeEventListener(NOTIFICATION_UNREAD_COUNT_CHANGED, handleUnreadCountChange);
  }, []);

  const handleMenuToggle = () => {
    if (isMobile) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => {
        const next = !c;
        try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
        return next;
      });
    }
  };

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="flex-shrink-0 h-full">
          <Sidebar
            collapsed={collapsed}
            onToggle={handleMenuToggle}
            notificationUnreadCount={notificationUnreadCount}
            recentMaterials={recentMaterials}
          />
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <Sidebar
          collapsed={false}
          isMobile
          onMobileClose={() => setMobileOpen(false)}
          notificationUnreadCount={notificationUnreadCount}
          recentMaterials={recentMaterials}
        />
      )}

      {/* Right: topbar + page content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuToggle={handleMenuToggle} />

        <main
          id="main-content"
          className="relative flex-1 overflow-y-auto"
          aria-label="Page content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
