import { Activity, Bell, ChevronLeft, ChevronRight, FileWarning, Loader2, LogOut, Menu, MonitorCog, Shield, SlidersHorizontal, Users, X } from 'lucide-react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

import { useAuth } from '../../auth/context/AuthContext';
import Button from '../../../shared/components/Button';
import VersoLogo from '../../../shared/components/VersoLogo';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'feedback', label: 'Feedback', icon: FileWarning },
  { id: 'announcements', label: 'Announcements & Updates', icon: Bell },
  { id: 'ai', label: 'AI Controls', icon: SlidersHorizontal },
  { id: 'health', label: 'Health & Logs', icon: Activity },
  { id: 'settings', label: 'Settings', icon: MonitorCog },
];
const COLLAPSED_KEY = 'sharp-study-admin-sidebar-collapsed';

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const activeSection = useMemo(() => {
    const section = searchParams.get('section') || 'overview';
    return NAV_ITEMS.some((item) => item.id === section) ? section : 'overview';
  }, [searchParams]);

  const firstName = profile?.first_name ?? profile?.full_name?.split(' ')[0] ?? 'Admin';

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const goToSection = (section) => {
    const next = new URLSearchParams(searchParams);
    next.set('section', section);
    ['owner', 'owner_id', 'type', 'q', 'page', 'archived', 'preview_id', 'preview_type', 'status', 'user_q', 'role', 'user_page'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: location.pathname === '/admin' });
    setMobileOpen(false);
  };

  const handleCollapseToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      // ignore persistence failure
    }
  };

  const renderNavContent = (forceExpanded = false) => {
    const compact = collapsed && !forceExpanded;

    return (
      <div className="flex h-full min-h-0 flex-col bg-sidebar">
        <div className={`shrink-0 border-b border-border ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}>
          {compact ? (
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent shadow-card">
                <VersoLogo size="compact" showText={false} />
              </span>
              <button
                type="button"
                onClick={handleCollapseToggle}
                className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-2 lg:inline-flex"
                aria-label="Expand admin sidebar"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent shadow-card">
                  <VersoLogo size="compact" showText={false} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Admin Control</p>
                  <p className="truncate text-lg font-black text-text">{firstName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCollapseToggle}
                className="hidden h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-2 lg:inline-flex"
                aria-label="Collapse admin sidebar"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <nav className={`admin-sidebar-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain ${compact ? 'px-3 py-4' : 'px-3 py-4'}`} aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToSection(item.id)}
                title={compact ? item.label : undefined}
                aria-label={compact ? item.label : undefined}
                className={`flex w-full cursor-pointer items-center rounded-2xl text-left transition-colors ${
                  compact ? 'h-14 justify-center px-0' : 'gap-3 px-4 py-3'
                } ${
                  active
                    ? 'bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)]'
                    : 'text-sidebar-text hover:bg-surface-2 hover:text-text'
                }`}
              >
                <item.icon size={20} aria-hidden="true" />
                {!compact ? (
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{item.label}</span>
                    <span className={`block truncate text-xs ${active ? 'text-white/80' : 'text-text-muted'}`}>
                      {item.id === 'overview' ? 'Simple platform snapshot' : item.id === 'users' ? 'Roles and accounts' : item.id === 'feedback' ? 'Reports and ratings' : item.id === 'announcements' ? 'User notifications' : item.id === 'ai' ? 'Prompts and limits' : item.id === 'health' ? 'Provider status' : 'Admin preferences'}
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
            title={compact ? 'Log out' : undefined}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-black text-rose-500 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'px-0' : ''}`}
          >
            {loggingOut ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}
            {!compact ? <span>{loggingOut ? 'Signing out' : 'Log out'}</span> : null}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg lg:flex lg:items-start">
      <aside className={`hidden shrink-0 self-start border-r border-border bg-sidebar transition-[width] duration-300 lg:sticky lg:top-0 lg:block ${collapsed ? 'w-[96px]' : 'w-[280px]'}`}>
        <div className="h-screen">
          {renderNavContent(false)}
        </div>
      </aside>

      {mobileOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-sidebar lg:hidden">
            <div className="h-full">
              {renderNavContent(true)}
            </div>
          </aside>
        </>
      ) : null}

      <div className="min-w-0 flex-1 bg-bg">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                className="rounded-xl p-2 text-text-muted hover:bg-surface-2"
                aria-label="Toggle admin navigation"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Admin Control</p>
                <p className="text-base font-black text-text">{NAV_ITEMS.find((item) => item.id === activeSection)?.label || 'Overview'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => goToSection('settings')}>
                Settings
              </Button>
              <Button variant="danger" size="sm" loading={loggingOut} onClick={handleLogout}>
                Exit
              </Button>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
