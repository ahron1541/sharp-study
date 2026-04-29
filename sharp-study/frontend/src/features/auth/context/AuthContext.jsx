import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Spinner from '../../../shared/components/Spinner';
import { applyPreferences } from '../../theme/hooks/useTheme';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';

// Singleton pattern to prevent Vite HMR from creating multiple instances
if (!globalThis.supabase) {
  globalThis.supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}
export const supabase = globalThis.supabase;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout for session check (5 seconds max to allow for profile fetch)
    const sessionTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Make the callback async so we can await the profile fetch
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        clearTimeout(sessionTimeout);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          localStorage.setItem('sharp-study-token', session.access_token);
          // AWAIT the profile fetch before dropping the loading screen
          await fetchProfile(session.user.id);
        }
        
        // NOW we stop loading, ensuring the theme is applied first
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(sessionTimeout);
        setUser(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          localStorage.setItem('sharp-study-token', session.access_token);
          // AWAIT here as well
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          localStorage.removeItem('sharp-study-token');
          localStorage.removeItem('sharp-study-role');
          localStorage.removeItem('sharp-study-prefs');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(sessionTimeout);
    };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error("Supabase error fetching profile:", error);
        return; // Exit early if profile doesn't exist yet
      }
        
      if (data) {
        setProfile(data);
        localStorage.setItem('sharp-study-role', data.role);
        
        // Safely parse preferences just in case Supabase returns a string
        let userPrefs = DEFAULT_PREFERENCES;
        if (data.preferences) {
          userPrefs = typeof data.preferences === 'string' 
            ? JSON.parse(data.preferences) 
            : data.preferences;
        }
        
        applyPreferences(userPrefs);
      }
    } catch (err) {
      console.error("Unexpected error in fetchProfile:", err);
    }
  };

  const resetThemeOnLogout = () => {
    applyPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem('sharp-study-token');
    localStorage.removeItem('sharp-study-refresh');
    localStorage.removeItem('sharp-study-role');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetThemeOnLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg, #ffffff)' }}>
        <Spinner size="lg" label="Loading your workspace..." />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);