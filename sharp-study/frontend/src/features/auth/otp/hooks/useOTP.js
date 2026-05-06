import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Manages OTP state: sending, verifying, cooldown, errors.
 *
 * @param {Function} requestFn  - service function that sends the OTP
 * @param {Function} verifyFn   - service function that verifies the OTP
 * @param {string}   email      - the email address OTP is sent to
 */
export function useOTP(requestFn, verifyFn, email, options = {}) {
  const { initialOtpSent = false } = options;
  const [otp,         setOtp]         = useState('');
  const [otpSent,     setOtpSent]     = useState(initialOtpSent);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sending,     setSending]     = useState(false);
  const [verifying,   setVerifying]   = useState(false);
  const [cooldown,    setCooldown]    = useState(0);
  const [error,       setError]       = useState('');
  const timerRef = useRef(null);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown]);

  const sendOTP = async () => {
    if (cooldown > 0 || sending || verifying) return;
    setSending(true);
    setError('');
    try {
      const response = await requestFn(email);
      setOtpSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('Verification code sent! Check your email.');
      return response;
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      return false;
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async () => {
    if (sending || verifying) return null;
    if (otp.replace(/\D/g, '').length < 6) {
      setError('Please enter all 6 digits.');
      return false;
    }
    setVerifying(true);
    setError('');
    try {
      const response = await verifyFn(email, otp);
      setOtpVerified(true);
      return response;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setOtp('');
    setOtpSent(initialOtpSent);
    setOtpVerified(false);
    setError('');
  };

  return {
    otp, setOtp,
    otpSent, otpVerified,
    sending, verifying,
    cooldown, error, setError,
    sendOTP, verifyOTP, reset,
  };
}
