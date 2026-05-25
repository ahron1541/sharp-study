import { NavLink, useLocation } from 'react-router-dom';
import {
  Archive,
  Home,
  BookMarked,
  Bell,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import VersoLogo from '../../../shared/components/VersoLogo';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home',         icon: Home },
  { to: '/library',   label: 'Your Library', icon: BookMarked },
  { to: '/notifications', label: 'Notification', icon: Bell, disabled: true, badge: 'Coming soon' },
];

const FOOTER_ITEMS = [
  { to: '/archive', label: 'Archive', icon: Archive },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({
  collapsed,
  isMobile,
  onMobileClose,
}) {
  const location = useLocation();
  const { profile } = useAuth();
  
  // UX FIX: Check if we are waiting for the profile to sync
  const isTransitioning = !profile;

  const sidebarWidth = collapsed ? 'w-[60px]' : 'w-[240px]';
  const baseClasses  = `
    flex flex-col h-full bg-sidebar border-r border-border
    transition-all duration-200 ease-in-out overflow-hidden
    ${sidebarWidth}
  `;

  const content = (
    <nav
      aria-label="Main navigation"
      className={baseClasses}
    >
      {/* Logo row */}
      <div className="flex items-center justify-center px-4 h-14 border-b border-border flex-shrink-0">
        {isTransitioning ? (
          <div 
            className={`h-8 rounded animate-pulse ${collapsed ? 'w-8' : 'w-24'}`} 
            style={{ background: 'var(--color-surface-2, #e2e8f0)' }} 
          />
        ) : (
          <VersoLogo size={collapsed ? 'compact' : 'lg'} showText={!collapsed} />
        )}
      </div>

      {/* Nav items */}
      <ul className="flex flex-col gap-1 p-2 flex-1 mt-1" role="list">
        {NAV_ITEMS.map((navItem, i) => {
          const { to, label, disabled, badge } = navItem;
          const isActive = location.pathname === to ||
            (to === '/dashboard' && location.pathname === '/');
            
          // If syncing, show skeleton items
          if (isTransitioning) {
            return (
              <li key={`skel-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <div className="w-5 h-5 rounded animate-pulse flex-shrink-0" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />
                {!collapsed && <div className="h-4 w-24 rounded animate-pulse" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />}
              </li>
            );
          }

          if (disabled) {
            return (
              <li key={to}>
                <div
                  aria-label={`${label} coming soon`}
                  aria-disabled="true"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text opacity-60"
                >
                  <navItem.icon size={18} aria-hidden="true" className="flex-shrink-0" />
                  {!collapsed ? (
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{label}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">
                        {badge}
                      </span>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          }

          return (
            <li key={to}>
              <NavLink
                to={to}
                aria-label={collapsed ? label : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={isMobile ? onMobileClose : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-colors duration-150 text-sm font-medium
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-accent focus-visible:ring-offset-1
                  ${isActive
                    ? 'bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)]'
                    : 'text-sidebar-text hover:bg-surface-2 hover:text-text'}
                `}
              >
                <navItem.icon size={18} aria-hidden="true" className="flex-shrink-0" />
                {!collapsed && (
                  <span className="whitespace-nowrap truncate">{label}</span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      {/* Footer actions — pinned to bottom */}
      <div className="p-2 border-t border-border flex-shrink-0">
        {isTransitioning ? (
          <div className="space-y-1">
            {[1, 2].map((item) => (
              <div key={item} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <div className="w-5 h-5 rounded animate-pulse flex-shrink-0" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />
                {!collapsed && <div className="h-4 w-16 rounded animate-pulse" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {FOOTER_ITEMS.map((footerItem) => {
              const { to, label } = footerItem;
              const FooterIcon = footerItem.icon;
              const isActive = location.pathname === to;
              return (
                <NavLink
                  key={to}
                  to={to}
                  aria-label={collapsed ? label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={isMobile ? onMobileClose : undefined}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-colors duration-150 text-sm font-medium
                    focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-accent focus-visible:ring-offset-1
                    ${isActive
                      ? 'bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)]'
                      : 'text-sidebar-text hover:bg-surface-2 hover:text-text'}
                  `}
                >
                  <FooterIcon size={18} aria-hidden="true" className="flex-shrink-0" />
                  {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );

  // Mobile: slide-over overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onMobileClose}
          aria-hidden="true"
        />
        {/* Drawer */}
        <div className="fixed inset-y-0 left-0 z-50 w-[240px] animate-slide-in-left">
          {content}
        </div>
      </>
    );
  }

  return content;
}
