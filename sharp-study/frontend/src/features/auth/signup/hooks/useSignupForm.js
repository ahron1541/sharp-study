import { useState, useEffect, useRef } from 'react';
import { sanitizePlainText } from '../../../../shared/utils/sanitize';
import { checkUsername, completeSignup } from '../../shared/services/auth.service';
import { isStrongPassword } from '../../shared/utils/passwordPolicy';
import { getUsernameValidationError, normalizeUsername } from '../../shared/utils/usernamePolicy';
import toast from 'react-hot-toast';

export function useSignupForm(email, signupToken) {
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    username: '', password: '', confirm_password: '',
  });
  const [errors,         setErrors]         = useState({});
  const [loading,        setLoading]         = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);
  // null | 'checking' | 'available' | 'taken' | 'invalid'
  const debounceRef = useRef(null);

  const update = (field, raw) => {
    if (loading) return;
    const cleanValue = sanitizePlainText(raw);
    const value = field === 'username' ? normalizeUsername(cleanValue) : cleanValue;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Debounced username check
  useEffect(() => {
    const name = normalizeUsername(form.username);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!name) {
        setUsernameStatus(null);
        return;
      }

      if (getUsernameValidationError(name)) {
        setUsernameStatus('invalid');
        return;
      }

      setUsernameStatus('checking');
      try {
        const res = await checkUsername(name);
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [form.username]);

  const validate = () => {
    const e = {};
    const usernameError = getUsernameValidationError(form.username);
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim())  e.last_name  = 'Last name is required.';
    if (usernameError) e.username = usernameError;
    if (usernameStatus === 'taken')  e.username = 'This username is already taken.';
    if (usernameStatus === 'invalid') e.username = usernameError || 'Username does not meet the rules.';
    if (!isStrongPassword(form.password)) e.password = 'Use at least 8 characters and pass 4 of the 5 strength checks.';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
    return e;
  };

  const submit = async () => {
    if (loading) return false;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return false; }
    if (!email || !signupToken) {
      toast.error('Your email verification has expired. Please request a new code.');
      return false;
    }
    setLoading(true);
    try {
      await completeSignup({ ...form, email, signup_token: signupToken });
      return true;
    } catch (err) {
      if (err.message?.toLowerCase().includes('username')) {
        setErrors({ username: err.message });
      } else {
        toast.error(err.message);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { form, update, errors, loading, usernameStatus, submit };
}
