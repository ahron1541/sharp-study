export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('sharp-study-token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};