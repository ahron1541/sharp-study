import { useState, useEffect, useRef } from 'react';
import { sanitizePlainText } from '../../../../shared/utils/sanitize';
import { checkUsername, completeSignup } from '../../shared/services/auth.service';
import toast from 'react-hot-toast';

const PASSWORD_CHECKS = [
  (v) => v.length >= 12,
  (v) => /[A-Z]/.test(v),
  (v) => /[a-z]/.test(v),
  (v) => /[0-9]/.test(v),
  (v) => /[^A-Za-z0-9]/.test(v),
];

function isStrongPassword(pw) {
  return PASSWORD_CHECKS.every((check) => check(pw));
}

export function useSignupForm(email) {
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
    const value = sanitizePlainText(raw);
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Debounced username check
  useEffect(() => {
    const name = form.username.trim();
    if (name.length < 3) { setUsernameStatus(null); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
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
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim())  e.last_name  = 'Last name is required.';
    if (form.username.length < 3)  e.username = 'Username must be at least 3 characters.';
    if (usernameStatus === 'taken')  e.username = 'This username is already taken.';
    if (usernameStatus === 'invalid') e.username = 'Only letters, numbers, _ . - are allowed.';
    if (!isStrongPassword(form.password)) e.password = 'Password does not meet all requirements.';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
    return e;
  };

  const submit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return false; }
    setLoading(true);
    try {
      await completeSignup({ ...form, email });
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