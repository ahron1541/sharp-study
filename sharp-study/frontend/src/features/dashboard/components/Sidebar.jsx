import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  BookMarked,
  Bell,
  Settings,
  Menu,
  X,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home',         icon: Home },
  { to: '/library',   label: 'Your Library', icon: BookMarked },
  { to: '/notifications', label: 'Notification', icon: Bell },
];

/**
 * Collapsible sidebar.
 *
 * Props:
 *   collapsed    — boolean
 *   onToggle     — () => void
 *   isMobile     — boolean (slide-over on mobile)
 *   onMobileClose — () => void
 */
export default function Sidebar({
  collapsed,
  onToggle,
  isMobile,
  onMobileClose,
}) {
  const location = useLocation();

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
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0">
        <BookOpen
          size={22}
          className="text-accent flex-shrink-0"
          aria-hidden="true"
        />
        {!collapsed && (
          <span className="font-extrabold text-text tracking-tight text-base whitespace-nowrap">
            SHARP<span className="text-accent">STUDY</span>
          </span>
        )}
      </div>

      {/* Nav items */}
      <ul className="flex flex-col gap-1 p-2 flex-1 mt-1" role="list">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to ||
            (to === '/dashboard' && location.pathname === '/');
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
                    : 'text-sidebar-text hover:bg-surface-2'}
                `}
              >
                <Icon size={18} aria-hidden="true" className="flex-shrink-0" />
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
              : 'text-sidebar-text hover:bg-surface-2'}
          `}
        >
          <Settings size={18} aria-hidden="true" className="flex-shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Settings</span>}
        </NavLink>
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