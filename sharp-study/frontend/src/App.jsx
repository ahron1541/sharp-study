import { Toaster } from 'react-hot-toast';
import { AccessibilityProvider } from './features/accessibility/context/AccessibilityContext';
import { AuthProvider } from './features/auth/context/AuthContext';
import AppRouter from './router/AppRouter';
import CookieConsent from './shared/components/CookieConsent';
import OfflineScreen from './shared/components/OfflineScreen';
import { useTheme } from './features/theme/hooks/useTheme';

export default function App() {
  // Theme is applied before first render via localStorage
  useTheme(); 

  return (
    <AccessibilityProvider>
      <AuthProvider>
        <AppRouter />
        
        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--card-bg)',
              color: 'var(--text-color)',
              border: '1px solid var(--card-border)',
            },
          }}
        />
        
        {/* GDPR cookie consent banner */}
        <CookieConsent />
        
        {/* PWA Offline Indicator */}
        <OfflineScreen />
      </AuthProvider>
    </AccessibilityProvider>
  );
}