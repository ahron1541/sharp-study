import { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar  from './TopBar';
import Spinner from '../../../shared/components/Spinner';

const COLLAPSED_KEY = 'sharp-study-sidebar-collapsed';
const ROUTE_LOADING_MIN_MS = 260;

/**
 * AppShell — the persistent layout for all post-login pages.
 * Renders: Sidebar + TopBar + <Outlet /> (the active page).
 */
export default function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed]     = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768);
  const [routeLoading, setRouteLoading] = useState(false);

  const routeLabel = useMemo(() => {
    if (location.pathname.startsWith('/library')) return 'Opening your library';
    if (location.pathname.startsWith('/archive')) return 'Opening your archive';
    if (location.pathname.startsWith('/settings')) return 'Opening your settings';
    if (location.pathname.startsWith('/study-guide/new')) return 'Opening the study guide editor';
    if (location.pathname.startsWith('/study-guide/')) return 'Opening your study guide';
    if (location.pathname.startsWith('/flashcards/')) return 'Opening your flashcards';
    if (location.pathname.startsWith('/quiz/')) return 'Opening your quiz';
    return 'Opening your dashboard';
  }, [location.pathname]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setIsMobile(window.innerWidth < 768);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      setRouteLoading(true);
    }, 0);
    const timer = window.setTimeout(() => {
      setRouteLoading(false);
    }, ROUTE_LOADING_MIN_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(timer);
    };
  }, [location.pathname, location.search]);

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
          aria-busy={routeLoading}
        >
          {routeLoading ? (
            <div className="pointer-events-none absolute inset-0 z-20">
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-surface-2">
                <div className="h-full w-2/5 animate-pulse rounded-full bg-accent" />
              </div>
              <div className="absolute inset-0 bg-bg/72 backdrop-blur-[1px]">
                <div className="mx-auto flex h-full max-w-7xl items-start px-4 py-6 sm:px-6 lg:px-8">
                  <div className="w-full rounded-[2rem] border border-border bg-surface/90 p-6 shadow-card">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
                        <Spinner size="sm" label={routeLabel} />
                      </div>
                      <div>
                        <p className="text-base font-black text-text">{routeLabel}</p>
                        <p className="text-sm text-text-muted">Preparing the next page for you.</p>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="h-32 animate-pulse rounded-[1.5rem] bg-surface-2" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
