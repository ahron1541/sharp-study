import { useState, useEffect } from 'react';
import Button from './Button';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50
                 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl
                 p-5 shadow-2xl"
    >
      <p className="text-sm text-[var(--text-color)] mb-1 font-semibold">
        🍪 We use cookies
      </p>
      <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
        We use essential cookies to keep you logged in and remember your preferences
        (like dark mode and font size). No tracking cookies without your consent.{' '}
        <a href="/privacy" className="text-[var(--accent)] underline">Learn more</a>
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={accept}>Accept</Button>
        <Button size="sm" variant="secondary" onClick={decline}>Decline</Button>
      </div>
    </div>
  );
}