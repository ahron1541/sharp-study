import { useState } from 'react';
import {
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPassword,
} from '../../shared/services/auth.service';
import { sanitizePlainText } from '../../../../shared/utils/sanitize';
import toast from 'react-hot-toast';

const STAGES = ['request', 'verify', 'reset', 'done'];

const PASSWORD_CHECKS = [
  (v) => v.length >= 12,
  (v) => /[A-Z]/.test(v),
  (v) => /[a-z]/.test(v),
  (v) => /[0-9]/.test(v),
  (v) => /[^A-Za-z0-9]/.test(v),
];

export function useForgotPassword() {
  const [stage,     setStage]     = useState('request');
  const [identifier, setIdentifier] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);

  const requestOTP = async () => {
    if (!identifier.trim()) {
      setErrors({ identifier: 'Email or username is required.' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const data = await requestPasswordResetOTP(sanitizePlainText(identifier));
      setResolvedEmail(data.email || identifier);
      setStage('verify');
      toast.success('Reset code sent! Check your email.');
    } catch {
      // Always advance (security: don't reveal if account exists)
      setResolvedEmail(identifier);
      setStage('verify');
      toast.success('If an account exists, a reset code was sent.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (otp) => {
    if (otp.replace(/\D/g, '').length < 6) return false;
    setLoading(true);
    try {
      await verifyPasswordResetOTP(resolvedEmail, otp);
      setStage('reset');
      return true;
    } catch (err) {
      setErrors({ otp: err.message });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    const errs = {};
    if (!PASSWORD_CHECKS.every((c) => c(password))) errs.password = 'Password does not meet all requirements.';
    if (password !== confirm) errs.confirm = 'Passwords do not match.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});
    try {
      await resetPassword(resolvedEmail, password);
      setStage('done');
    } catch (err) {
      if (err.message?.includes('reuse')) {
        setErrors({ password: err.message });
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    stage,
    identifier, setIdentifier,
    resolvedEmail,
    password, setPassword,
    confirm, setConfirm,
    errors, setErrors, loading,
    requestOTP, verifyOTP, submitNewPassword,
  };
}