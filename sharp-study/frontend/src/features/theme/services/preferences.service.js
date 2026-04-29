import { supabase } from '../../auth/context/AuthContext';
import { API_URL }  from '../../../config/api';

/**
 * Gets a fresh access token from Supabase.
 * Clears old local tokens if the session is dead.
 */
async function getFreshToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      localStorage.setItem('sharp-study-token', session.access_token);
      return session.access_token;
    } else {
      // If Supabase knows we aren't logged in, clear the dead token!
      localStorage.removeItem('sharp-study-token');
      return null;
    }
  } catch {
    return null;
  }
}

export async function fetchPreferences() {
  const token = await getFreshToken();
  if (!token) throw new Error('Not authenticated.');

  const res = await fetch(`${API_URL}/api/auth/preferences`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error('Failed to load preferences.');
  return res.json();
}

export async function savePreferences(preferences) {
  const token = await getFreshToken();
  if (!token) throw new Error('Not authenticated.');

  const res = await fetch(`${API_URL}/api/auth/preferences`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ preferences }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to save preferences.');
  }
  return res.json();
}