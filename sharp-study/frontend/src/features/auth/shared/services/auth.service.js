// All auth API calls in one place.
// Components import functions from here, never call fetch() directly.

const BASE = import.meta.env.VITE_API_URL;

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('sharp-study-token');
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',   // sends cookies (CSRF token)
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { code: data.code });
  return data;
}

// ─── Login ───
export const loginUser = (payload) =>
  request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });

// ─── Signup ───
export const requestSignupOTP = (email) =>
  request('/api/auth/signup/request-otp', { method: 'POST', body: JSON.stringify({ email }) });

export const verifySignupOTP = (email, otp) =>
  request('/api/auth/signup/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) });

export const checkUsername = (username) =>
  request(`/api/auth/signup/check-username?username=${encodeURIComponent(username)}`);

export const completeSignup = (payload) =>
  request('/api/auth/signup/complete', { method: 'POST', body: JSON.stringify(payload) });

// ─── Forgot Password ───
export const requestPasswordResetOTP = (identifier) =>
  request('/api/auth/forgot-password/request-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });

export const verifyPasswordResetOTP = (email, otp) =>
  request('/api/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });

export const resetPassword = (email, password) =>
  request('/api/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });