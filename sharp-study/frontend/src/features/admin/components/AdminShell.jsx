import { Activity, Bell, ChevronLeft, ChevronRight, FileWarning, LogOut, Menu, MonitorCog, Shield, SlidersHorizontal, Users, X } from 'lucide-react';
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

  const navContent = (
    <div className="flex min-h-full flex-col bg-sidebar">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent shadow-card">
              <VersoLogo size="compact" showText={false} />
            </span>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Admin Control</p>
                <p className="truncate text-lg font-black text-text">{firstName}</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleCollapseToggle}
            className="hidden cursor-pointer rounded-xl p-2 text-text-muted transition-colors hover:bg-surface-2 lg:inline-flex"
            aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToSection(item.id)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                active
                  ? 'bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)]'
                  : 'text-sidebar-text hover:bg-surface-2 hover:text-text'
              }`}
            >
              <item.icon size={18} aria-hidden="true" />
              {!collapsed ? (
                <span>
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className={`block text-xs ${active ? 'text-white/80' : 'text-text-muted'}`}>
                    {item.id === 'overview' ? 'Simple platform snapshot' : item.id === 'users' ? 'Roles and accounts' : item.id === 'feedback' ? 'Reports and ratings' : item.id === 'announcements' ? 'User notifications' : item.id === 'ai' ? 'Prompts and limits' : item.id === 'health' ? 'Provider status' : 'Admin preferences'}
                  </span>
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-border p-3">
        <Button
          variant="danger"
          size="sm"
          className="w-full"
          loading={loggingOut}
          icon={<LogOut size={14} />}
          onClick={handleLogout}
        >
          Log out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg lg:flex lg:items-start">
      <aside className={`hidden shrink-0 self-start border-r border-border bg-sidebar transition-[width] duration-300 lg:sticky lg:top-0 lg:block ${collapsed ? 'w-[96px]' : 'w-[280px]'}`}>
        <div className="h-screen">
          {navContent}
        </div>
      </aside>

      {mobileOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-sidebar lg:hidden">
            <div className="h-full">
              {navContent}
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
