import { API_URL } from '../../../config/api';
import { supabase } from '../../auth/context/AuthContext';

/**
 * Safely retrieves the active session token directly from Supabase's core engine,
 * guaranteeing we never send "null" or "undefined" to the backend.
 */
async function getValidToken() {
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token || localStorage.getItem('sharp-study-token');

  // Guard against missing, expired, or garbage string tokens
  if (error || !token || token === 'null' || token === 'undefined') {
    throw new Error('Not authenticated. Please log in again.');
  }
  
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
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to save preferences.');
  }
  
  return res.json();
}