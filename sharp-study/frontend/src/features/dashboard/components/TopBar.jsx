import { Menu, User } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import versoLogo from '../../../assets/logo/verso_logo.svg';

export default function TopBar({ onMenuToggle }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);

  // UX FIX: Check if we are waiting for the profile to sync
  const isTransitioning = !profile;

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

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
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
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onMenuToggle}
          disabled={loggingOut}
          aria-label="Toggle navigation menu"
          className="
            p-2 rounded-lg text-text-muted hover:bg-surface-2
            transition-colors focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-accent
            flex-shrink-0
          "
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        {isTransitioning ? (
          <div className="h-4 w-20 ml-2 rounded animate-pulse" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />
        ) : (
          <img 
            src={versoLogo}
            alt="Verso"
            className="h-3 sm:h-4 w-auto max-w-none flex-shrink-0"
            style={{ maxHeight: '1rem' }}
          />
        )}
      </div>

      {/* Right: theme toggle + welcome + user menu */}
      <div className="flex items-center gap-3">
        {isTransitioning ? (
          <>
            {/* Welcome Text Skeleton */}
            <div className="h-4 w-20 rounded animate-pulse hidden sm:block" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />
            {/* User Icon Skeleton */}
            <div className="w-9 h-9 rounded-lg animate-pulse" style={{ background: 'var(--color-surface-2, #e2e8f0)' }} />
          </>
        ) : (
          <>
            <span
              className="text-sm font-medium text-text hidden sm:block"
              aria-label={`Logged in as ${firstName}`}
            >
              {firstName}
            </span>

            {/* User dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                disabled={loggingOut}
                aria-label="Open user menu"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className="
                  p-2 rounded-lg text-text-muted hover:bg-surface-2
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
                    disabled={loggingOut}
                    className="
                      w-full text-left px-4 py-2 text-sm text-red-500
                      hover:bg-surface-2 transition-colors
                    "
                  >
                    {loggingOut ? 'Logging out...' : 'Log out'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
