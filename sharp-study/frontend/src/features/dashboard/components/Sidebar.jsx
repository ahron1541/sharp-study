import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  BookMarked,
  Bell,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import versoLogo from '../../../assets/logo/verso_w_name.svg';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home',         icon: Home },
  { to: '/library',   label: 'Your Library', icon: BookMarked },
  { to: '/notifications', label: 'Notification', icon: Bell },
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
          <img 
            src={versoLogo}
            alt="Verso"
            className={`${collapsed ? 'h-8' : 'h-10'} w-auto transition-all duration-200`}
          />
        )}
      </div>

      {/* Nav items */}
      <ul className="flex flex-col gap-1 p-2 flex-1 mt-1" role="list">
        {NAV_ITEMS.map((navItem, i) => {
          const { to, label } = navItem;
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

      {/* Settings — pinned to bottom */}
      <div className="p-2 border-t border-border flex-shrink-0">
        {isTransitioning ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-5 h-5 rounded animate-pulse flex-shrink-0" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />
            {!collapsed && <div className="h-4 w-16 rounded animate-pulse" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />}
          </div>
        ) : (
          <NavLink
            to="/settings"
            aria-label={collapsed ? 'Settings' : undefined}
            aria-current={location.pathname === '/settings' ? 'page' : undefined}
            onClick={isMobile ? onMobileClose : undefined}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg
              transition-colors duration-150 text-sm font-medium
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-accent focus-visible:ring-offset-1
              ${location.pathname === '/settings'
                ? 'bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)]'
                : 'text-sidebar-text hover:bg-surface-2 hover:text-text'}
            `}
          >
            <Settings size={18} aria-hidden="true" className="flex-shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">Settings</span>}
          </NavLink>
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
