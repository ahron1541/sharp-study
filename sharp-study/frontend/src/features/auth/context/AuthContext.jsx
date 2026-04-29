import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        localStorage.setItem('sharp-study-token', session.access_token);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          localStorage.setItem('sharp-study-token', session.access_token);
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          localStorage.removeItem('sharp-study-token');
          localStorage.removeItem('sharp-study-role');
          localStorage.removeItem('sharp-study-prefs');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data);
      localStorage.setItem('sharp-study-role', data.role);
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

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, supabase }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);