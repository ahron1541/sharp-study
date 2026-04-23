import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import Button from './Button';

const TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes
const WARNING_MS = 5  * 60 * 1000;   // warn 5 min before

export default function SessionTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const timerRef = useRef(null);
  const warnRef = useRef(null);

  const reset = () => {
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    if (!user) return;

    warnRef.current = setTimeout(() => setShowWarning(true), TIMEOUT_MS - WARNING_MS);
    timerRef.current = setTimeout(async () => {
      await signOut();
      navigate('/login?reason=timeout');
    }, TIMEOUT_MS);
  };

  useEffect(() => {
    if (!user) return;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
    };
  }, [user]);

  const stayLoggedIn = () => { setShowWarning(false); reset(); };

  return (
    <Modal isOpen={showWarning} onClose={stayLoggedIn} title="⚠️ Session Expiring Soon" size="sm">
      <p className="text-[var(--text-color)] mb-4">
        You've been inactive for a while. You'll be automatically logged out in 5 minutes
        to protect your account.
      </p>
      <div className="flex gap-2">
        <Button onClick={stayLoggedIn}>Stay Logged In</Button>
        <Button variant="secondary" onClick={() => { signOut(); navigate('/login'); }}>
          Log Out Now
        </Button>
      </div>
    </Modal>
  );
}