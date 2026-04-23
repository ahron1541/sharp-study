import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, BookOpen, LogOut, Settings, LayoutDashboard, Shield } from 'lucide-react';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useAccessibility } from '../../features/accessibility/context/AccessibilityContext';
import AccessibilityPanel from '../../features/accessibility/components/AccessibilityPanel';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useAccessibility();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} /> },
    ...(profile?.role === 'admin'
      ? [{ label: 'Admin', href: '/admin', icon: <Shield size={16} /> }]
      : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Only show navbar when logged in
  if (!user) return null;

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 bg-[var(--card-bg)] border-b border-[var(--card-border)]
                 backdrop-blur-md bg-opacity-95"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 font-bold text-xl text-[var(--text-color)]
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded"
          aria-label="Sharp Study — Go to dashboard"
        >
          <BookOpen className="text-[var(--accent)]" size={24} aria-hidden="true" />
          <span>Sharp<span className="text-[var(--accent)]">Study</span></span>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              aria-current={location.pathname === link.href ? 'page' : undefined}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                         transition-colors focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-[var(--accent)]
                         ${location.pathname === link.href
                           ? 'bg-[var(--accent)] text-white'
                           : 'text-[var(--muted)] hover:text-[var(--text-color)] hover:bg-[var(--card-border)]'}`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className="p-2 rounded-lg hover:bg-[var(--card-border)] transition-colors
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Accessibility settings */}
          <button
            onClick={() => setA11yOpen(true)}
            aria-label="Open accessibility settings"
            className="p-2 rounded-lg hover:bg-[var(--card-border)] transition-colors
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            ♿
          </button>

          {/* User menu — desktop */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-[var(--muted)]">
              {profile?.full_name?.split(' ')[0] ?? 'User'}
            </span>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-[var(--card-border)]
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden border-t border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium
                         text-[var(--text-color)] hover:bg-[var(--card-border)] transition-colors"
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium
                       text-red-500 hover:bg-red-50 transition-colors w-full mt-1"
          >
            <LogOut size={16} />
            Log out
          </button>
        </nav>
      )}

      {/* Accessibility Panel Modal */}
      <AccessibilityPanel isOpen={a11yOpen} onClose={() => setA11yOpen(false)} />
    </header>
  );
}