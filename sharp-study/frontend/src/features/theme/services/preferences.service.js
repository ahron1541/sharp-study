import { API_URL } from '../../../config/api';

/**
 * Fetch the current user's preferences from the backend.
 * The backend reads the profiles.preferences JSONB column.
 */
export async function fetchPreferences() {
  const token = localStorage.getItem('sharp-study-token');
  const res = await fetch(`${API_URL}/api/auth/preferences`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error('Failed to load preferences.');
  return res.json(); // returns { preferences: { ... } }
}

/**
 * Persist updated preferences to the backend.
 */
export async function savePreferences(preferences) {
  const token = localStorage.getItem('sharp-study-token');
  const res = await fetch(`${API_URL}/api/auth/preferences`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ preferences }),
  });
  if (!res.ok) throw new Error('Failed to save preferences.');
  return res.json();
}