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
      const data = await loginUser({
        identifier: sanitizePlainText(identifier),
        password,
        rememberMe,
      });

      // Store token
      localStorage.setItem('sharp-study-token', data.access_token);
      if (rememberMe) {
        localStorage.setItem('sharp-study-refresh', data.refresh_token);
      }

      // Sync Supabase client session (needed for RLS)
      await supabase.auth.setSession({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
      });

      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'ACCOUNT_LOCKED') {
        setLockInfo(err.message);
      } else {
        setErrors({ form: err.message });
      }
    } finally {
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