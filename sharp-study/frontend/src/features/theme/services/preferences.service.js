import { API_URL } from '../../../config/api';
import { supabase } from '../../auth/context/AuthContext';

/**
 * Safely retrieves the active session token directly from Supabase's core engine,
 * guaranteeing we never send "null" or "undefined" to the backend.
 */
async function getValidToken() {
  const { data, error } = await supabase.auth.getSession();
  let token = data?.session?.access_token || '';

  if (!token) {
    const accessToken = localStorage.getItem('sharp-study-token');
    const refreshToken = localStorage.getItem('sharp-study-refresh');

    if (accessToken && refreshToken) {
      const { data: restored, error: restoreError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!restoreError) {
        token = restored?.session?.access_token || '';
      }
    }
  }

  // Guard against missing, expired, or garbage string tokens
  if (error || !token || token === 'null' || token === 'undefined') {
    localStorage.removeItem('sharp-study-token');
    throw new Error('Not authenticated. Please log in again.');
  }

  localStorage.setItem('sharp-study-token', token);
  
  return token;
}

export async function fetchPreferences() {
  const token = await getValidToken();

  const res = await fetch(`${API_URL}/api/auth/preferences`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('sharp-study-token');
      throw new Error('Not authenticated. Please log in again.');
    }
    throw new Error('Failed to load preferences.');
  }
  return res.json();
}

export async function savePreferences(preferences) {
  const token = await getValidToken();

  const res = await fetch(`${API_URL}/api/auth/preferences`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ preferences }),
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('sharp-study-token');
      throw new Error('Not authenticated. Please log in again.');
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to save preferences.');
  }
  
  return res.json();
}
