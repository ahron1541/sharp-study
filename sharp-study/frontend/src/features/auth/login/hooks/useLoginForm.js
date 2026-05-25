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
  const [transitionLabel, setTransitionLabel] = useState('');
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
    if (loading) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setTransitionLabel('Opening account...');
    setErrors({});
    setLockInfo(null);

    try {
      const data = await loginUser({
        identifier: sanitizePlainText(identifier),
        password,
        rememberMe,
      });

      const accessToken = data.access_token || data.session?.access_token || data.data?.session?.access_token;
      const refreshToken = data.refresh_token || data.session?.refresh_token || data.data?.session?.refresh_token;

      if (!accessToken) throw new Error("No access token from server.");

      localStorage.setItem('sharp-study-token', accessToken);
      if (rememberMe && refreshToken) localStorage.setItem('sharp-study-refresh', refreshToken);

      setTransitionLabel('Checking your session...');
      const sessionResponse = await supabase.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken || '',
      });

      setTransitionLabel('Preparing your workspace...');
      const roleSourceUserId = data.user?.id || sessionResponse?.data?.session?.user?.id;
      let nextPath = '/dashboard';

      if (roleSourceUserId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', roleSourceUserId)
          .single();

        if (profileData?.role === 'admin') {
          nextPath = '/admin';
        }
      }

      setTransitionLabel(nextPath === '/admin' ? 'Opening Admin Control...' : 'Opening your dashboard...');
      navigate(nextPath);

    } catch (err) {
      setErrors({ form: err.message || 'An unexpected login error occurred.' });
    } finally {
      setLoading(false);
      setTransitionLabel('');
    }
  };

  return {
    identifier, setIdentifier,
    password,   setPassword,
    rememberMe, setRememberMe,
    errors, loading, transitionLabel, lockInfo,
    clearFieldError, submit,
  };
}
