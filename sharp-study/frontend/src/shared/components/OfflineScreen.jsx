import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import Button from './Button';

export default function OfflineScreen() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label="Offline mode activated"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 bg-[var(--bg-color)] px-4 text-center"
    >
      <WifiOff size={64} className="text-[var(--muted)] mb-6" aria-hidden="true" />
      <h1 className="text-2xl font-bold text-[var(--text-color)] mb-2">
        You're Offline
      </h1>
      <p className="text-[var(--muted)] mb-8 max-w-sm">
        No internet connection detected. Previously loaded study guides are still
        accessible from your library.
      </p>
      <Button
        icon={<RefreshCw size={16} />}
        onClick={() => window.location.reload()}
      >
        Try Again
      </Button>
    </div>
  );
}