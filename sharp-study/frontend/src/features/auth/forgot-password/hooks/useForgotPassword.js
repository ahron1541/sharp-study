import { useState } from 'react';
import {
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPassword,
} from '../../shared/services/auth.service';
import { sanitizePlainText } from '../../../../shared/utils/sanitize';
import { isStrongPassword } from '../../shared/utils/passwordPolicy';
import toast from 'react-hot-toast';

const STAGES = ['request', 'verify', 'reset', 'done'];

export function useForgotPassword() {
  const [stage,     setStage]     = useState('request');
  const [identifier, setIdentifier] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);

  const requestOTP = async () => {
    if (loading) return;
    if (!identifier.trim()) {
      setErrors({ identifier: 'Email or username is required.' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const data = await requestPasswordResetOTP(sanitizePlainText(identifier));
      setResolvedEmail(data.email || identifier);
      setResetToken('');
      setStage('verify');
      toast.success('Reset code sent! Check your email.');
    } catch (err) {
      const message = err.message || 'Reset code could not be sent. Please try again.';
      setErrors({ identifier: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (otp) => {
    if (loading) return false;
    if (otp.replace(/\D/g, '').length < 6) return false;
    setLoading(true);
    try {
      const response = await verifyPasswordResetOTP(resolvedEmail, otp);
      setResetToken(response?.reset_token || '');
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
    if (loading) return;
    const errs = {};
    if (!isStrongPassword(password)) errs.password = 'Use at least 8 characters and pass 4 of the 5 strength checks.';
    if (password !== confirm) errs.confirm = 'Passwords do not match.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});
    try {
      await resetPassword(resolvedEmail, password, resetToken);
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
    resetToken,
    password, setPassword,
    confirm, setConfirm,
    errors, setErrors, loading,
    requestOTP, verifyOTP, submitNewPassword,
  };
}
