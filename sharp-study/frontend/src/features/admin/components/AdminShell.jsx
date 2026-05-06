import { LogOut, Shield } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { useAuth } from '../../auth/context/AuthContext';
import Button from '../../../shared/components/Button';

export default function AdminShell() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

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

  const firstName = profile?.first_name ?? profile?.full_name?.split(' ')[0] ?? 'Admin';

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-text">
              <Shield size={20} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Admin Control</p>
              <p className="text-base font-black text-text">{firstName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/admin')}
            >
              Dashboard
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={loggingOut}
              icon={<LogOut size={14} />}
              onClick={handleLogout}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
