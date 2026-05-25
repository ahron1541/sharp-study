import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar  from './TopBar';

const COLLAPSED_KEY = 'sharp-study-sidebar-collapsed';

/**
 * AppShell — the persistent layout for all post-login pages.
 * Renders: Sidebar + TopBar + <Outlet /> (the active page).
 */
export default function AppShell() {
  const [collapsed, setCollapsed]     = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setIsMobile(window.innerWidth < 768);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
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
          />
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <Sidebar
          collapsed={false}
          isMobile
          onMobileClose={() => setMobileOpen(false)}
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
