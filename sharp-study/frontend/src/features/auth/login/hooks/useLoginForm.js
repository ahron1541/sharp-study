import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginUser } from '../../shared/services/auth.service';
import { sanitizePlainText } from '../../../../shared/utils/sanitize';

export function useLoginForm() {
  const { supabase } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors,     setErrors]     = useState({});
  const [loading,    setLoading]    = useState(false);
  const [lockInfo,   setLockInfo]   = useState(null);

  const clearFieldError = (field) =>
    setErrors((prev) => ({ ...prev, [field]: null, form: null }));

  const validate = () => {
    const e = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required.';
    if (!password)           e.password   = 'Password is required.';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});
    setLockInfo(null);

    try {
      console.log("1. Starting login request...");
      const data = await loginUser({
        identifier: sanitizePlainText(identifier),
        password,
        rememberMe,
      });
      console.log("2. Backend login successful! Data received:", data);

      const accessToken = data.access_token || data.session?.access_token || data.data?.session?.access_token;
      const refreshToken = data.refresh_token || data.session?.refresh_token || data.data?.session?.refresh_token;

      console.log("3. Extracted tokens. Access:", !!accessToken, "Refresh:", !!refreshToken);

      if (!accessToken) throw new Error("No access token from server.");

      localStorage.setItem('sharp-study-token', accessToken);
      if (rememberMe && refreshToken) localStorage.setItem('sharp-study-refresh', refreshToken);

      console.log("4. Attempting to set Supabase session...");
      const sessionResponse = await supabase.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken || '',
      });
      console.log("5. Session set response:", sessionResponse);

      console.log("6. Navigating to dashboard...");
      navigate('/dashboard');

    } catch (err) {
      console.error("CRITICAL ERROR IN SUBMIT:", err);
      setErrors({ form: err.message || 'An unexpected login error occurred.' });
    } finally {
      console.log("7. Finally block executed. Stopping loading spinner.");
      setLoading(false);
    }
  };

  return {
    identifier, setIdentifier,
    password,   setPassword,
    rememberMe, setRememberMe,
    errors, loading, lockInfo,
    clearFieldError, submit,
  };
}