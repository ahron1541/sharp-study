import { Menu, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applyPreferences } from '../../theme/hooks/useTheme';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';

/**
 * Top application bar.
 *
 * Props:
 *   onMenuToggle — () => void   called when hamburger is clicked
 */
export default function TopBar({ onMenuToggle }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute('data-display') === 'dark'
  );
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const toggleDisplayMode = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);

    // Read current prefs from localStorage and flip display_mode
    let currentPrefs = DEFAULT_PREFERENCES;
    try {
      const raw = localStorage.getItem('sharp-study-prefs');
      if (raw) currentPrefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch { /* ignore */ }

    applyPreferences({ ...currentPrefs, display_mode: next });
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const firstName = profile?.first_name ?? profile?.full_name?.split(' ')[0] ?? 'User';

  return (
    <header
      className="
        h-14 flex items-center justify-between
        px-4 bg-surface border-b border-border
        flex-shrink-0 z-30
      "
      role="banner"
    >
      {/* Left: hamburger + logo (shown only on mobile when sidebar is closed) */}
      <div className="flex items-center gap-1">
        <button
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          className="
            p-2 rounded-lg text-muted hover:bg-surface-2
            transition-colors focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-accent
            flex-shrink-0
          "
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <img 
          src="/src/assets/logo/verso_logo.svg" 
          alt="Verso"
          className="h-3 sm:h-4 w-auto max-w-none flex-shrink-0"
          style={{ maxHeight: '1rem' }}
        />
      </div>

      {/* Right: theme toggle + welcome + user menu */}
      <div className="flex items-center gap-3">
        {/* Dark/light toggle */}
        <button
          onClick={toggleDisplayMode}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDark}
          className="
            p-2 rounded-lg text-muted hover:bg-surface-2
            transition-colors focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-accent
          "
        >
          {isDark
            ? <Sun  size={18} aria-hidden="true" />
            : <Moon size={18} aria-hidden="true" />}
        </button>

        {/* Welcome text */}
        <span
          className="text-sm font-medium text-text hidden sm:block"
          aria-label={`Logged in as ${firstName}`}
        >
          Welcome, {firstName}
        </span>

        {/* User dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-label="Open user menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            className="
              p-2 rounded-lg text-muted hover:bg-surface-2
              transition-colors focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-accent
            "
          >
            <User size={18} aria-hidden="true" />
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              aria-label="User options"
              className="
                absolute right-0 top-full mt-1 w-44
                bg-surface border border-border rounded-xl
                shadow-card py-1 z-50 animate-fade-in
              "
            >
              <Link
                to="/settings"
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
                className="
                  block px-4 py-2 text-sm text-text
                  hover:bg-surface-2 transition-colors
                "
              >
                Settings
              </Link>
              <hr className="my-1 border-border" />
              <button
                role="menuitem"
                onClick={handleLogout}
                className="
                  w-full text-left px-4 py-2 text-sm text-red-500
                  hover:bg-surface-2 transition-colors
                "
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}