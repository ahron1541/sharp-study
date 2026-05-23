import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AiOutlineWarning } from 'react-icons/ai';
import { MdLockReset } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import {
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
} from '../../shared/services/auth.service';
import { useOTP }             from '../../otp/hooks/useOTP';
import { useForgotPassword }  from '../hooks/useForgotPassword';
import OTPInput               from '../../otp/components/OTPInput';
import PillInput              from '../../shared/components/PillInput';
import PasswordInput          from '../../shared/components/PasswordInput';
import PasswordStrength       from '../../shared/components/PasswordStrength';
import PillButton             from '../../shared/components/PillButton';
import styles                 from './ForgotPasswordFlow.module.css';

const slideVariants = {
  enter:  { x: 24, opacity: 0 },
  center: { x: 0,  opacity: 1 },
  exit:   { x: -24, opacity: 0 },
};

export default function ForgotPasswordFlow() {
  const { t } = useTranslation('auth', { keyPrefix: 'forgot' });
  const navigate = useNavigate();
  const fp = useForgotPassword();
  const resetConfirmTouched = fp.confirm.length > 0;
  const resetPasswordsMatch = resetConfirmTouched && fp.password === fp.confirm;
  const resetPasswordsMismatch = resetConfirmTouched && fp.password !== fp.confirm;

  const {
    otp, setOtp,
    cooldown, error: otpHookError, setError: setOtpError,
    sending: otpSending,
    sendOTP: resendResetOTP,
  } = useOTP(requestPasswordResetOTP, verifyPasswordResetOTP, fp.resolvedEmail);
  const busy = fp.loading || otpSending;
  const busyMessage =
    fp.stage === 'request'
      ? 'Sending your recovery code...'
      : fp.stage === 'verify'
        ? 'Checking your code...'
        : 'Updating your password...';

  const handleOtpChange = (nextValue) => {
    setOtp(nextValue);
    setOtpError('');
    fp.setErrors((prev) => ({ ...prev, otp: null }));
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (fp.loading || otpSending) return;
    const ok = await fp.verifyOTP(otp);
    if (!ok && fp.errors.otp) setOtpError(fp.errors.otp);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={fp.stage}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={styles.wrapper}
      >
        {/* ── Stage 1: Request email / username ── */}
        {fp.stage === 'request' && (
          <>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{t('title')}</h1>
              <p className={styles.subtitle}>{t('subtitle')}</p>
            </div>

            <div className={styles.infoCard}>
              <strong>Quick recovery</strong>
              <span>We’ll send a 6-digit code to your registered email using the same OTP email provider as signup.</span>
            </div>

            <AnimatePresence>
              {busy && (
                <motion.div
                  className={styles.inlineStatus}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <span className={styles.inlineSpinner} aria-hidden="true" />
                  {busyMessage}
                  <span className={styles.inlineProgress} aria-hidden="true"><span /></span>
                </motion.div>
              )}
            </AnimatePresence>

            <form
              onSubmit={(e) => { e.preventDefault(); if (!fp.loading) fp.requestOTP(); }}
              noValidate
              aria-busy={fp.loading}
            >
              <div className={styles.fields}>
                {/*
                  Email/username input — wireframe shows "Email" label
                  with "Send" as inline right button (Account_Recovery_1_1)
                */}
                <PillInput
                  id="fp-identifier"
                  label={t('identifierLabel')}
                  type="text"
                  value={fp.identifier}
                  onChange={(e) => { fp.setIdentifier(e.target.value); fp.setErrors({}); }}
                  autoComplete="username email"
                  placeholder="Enter your email"
                  required
                  disabled={fp.loading}
                  error={fp.errors.identifier}
                  rightAddon={{
                    label:    fp.loading ? 'Sending...' : 'Send',
                    ariaLabel: 'Send reset code',
                    onClick:  (e) => { e.preventDefault(); fp.requestOTP(); },
                    disabled: fp.loading,
                  }}
                />
              </div>
            </form>

            <div className={styles.backLinkRow}>
              <Link
                to="/login"
                onClick={(event) => {
                  if (fp.loading) event.preventDefault();
                }}
                className={`${styles.backLink} ${fp.loading ? styles.disabledLink : ''}`}
                aria-disabled={fp.loading}
              >
                Back to Login
              </Link>
            </div>
          </>
        )}

        {/* ── Stage 2: Enter OTP ── */}
        {fp.stage === 'verify' && (
          <>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{t('otpTitle')}</h1>
              <p className={styles.subtitle}>
                {t('otpSubtitle')} <strong>{fp.resolvedEmail}</strong>
              </p>
            </div>

            <AnimatePresence>
              {busy && (
                <motion.div
                  className={styles.inlineStatus}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <span className={styles.inlineSpinner} aria-hidden="true" />
                  {busyMessage}
                  <span className={styles.inlineProgress} aria-hidden="true"><span /></span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleVerifyOTP} noValidate aria-busy={fp.loading || otpSending}>
              <div className={styles.fields}>
                <p className={styles.otpLabel}>Enter the 6-digit reset code</p>

                <OTPInput
                  value={otp}
                  onChange={handleOtpChange}
                  error={!!(otpHookError || fp.errors.otp)}
                  disabled={fp.loading || otpSending}
                />

                {(otpHookError || fp.errors.otp) && (
                  <p role="alert" className={styles.otpError}>
                    <AiOutlineWarning size={13} aria-hidden="true" />
                    {otpHookError || fp.errors.otp}
                  </p>
                )}

                <p className={styles.otpMeta}>
                  Code expires in {import.meta.env.VITE_OTP_EXPIRY_MINUTES ?? 10} minutes
                </p>

                <div className={styles.submitRow}>
                  <PillButton
                    type="submit"
                    loading={fp.loading}
                    disabled={otpSending || otp.replace(/\D/g, '').length < 6}
                  >
                    {t('verifyOTP')}
                  </PillButton>
                </div>

                <button
                  type="button"
                  onClick={resendResetOTP}
                  disabled={cooldown > 0 || otpSending || fp.loading}
                  className={styles.resendBtn}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={fp.returnToRequest}
                  disabled={busy}
                  className={styles.resendBtn}
                >
                  Use a different email or username
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Stage 3: New password ── */}
        {fp.stage === 'reset' && (
          <>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{t('newPasswordTitle')}</h1>
              <p className={styles.subtitle}>
                Choose a new password. You cannot reuse passwords from the last 5 months.
              </p>
            </div>

            <AnimatePresence>
              {busy && (
                <motion.div
                  className={styles.inlineStatus}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <span className={styles.inlineSpinner} aria-hidden="true" />
                  {busyMessage}
                  <span className={styles.inlineProgress} aria-hidden="true"><span /></span>
                </motion.div>
              )}
            </AnimatePresence>

            <form
              onSubmit={(e) => { e.preventDefault(); if (!fp.loading) fp.submitNewPassword(); }}
              noValidate
              aria-busy={fp.loading}
            >
              <div className={styles.fields}>
                {/*
                  Greyed-out username display — matches Account_Recovery_1_2 wireframe.
                  The "Username" field is shown as disabled/locked.
                */}
                <PillInput
                  id="fp-username-display"
                  label="Recovery email"
                  type="text"
                  value={fp.resolvedEmail}
                  onChange={() => {}}
                  disabled
                  aria-label="Account identifier — cannot be changed"
                />

                <PasswordInput
                  id="fp-new-password"
                  label={t('newPassword')}
                  value={fp.password}
                  onChange={(e) => {
                    fp.setPassword(e.target.value);
                    fp.setErrors((p) => ({ ...p, password: null }));
                  }}
                  error={fp.errors.password}
                  autoComplete="new-password"
                  describedBy="fp-pw-strength"
                  placeholder="Enter New Password"
                  disabled={fp.loading}
                />
                <PasswordStrength password={fp.password} id="fp-pw-strength" />

                <PasswordInput
                  id="fp-confirm-password"
                  label={t('confirmPassword')}
                  value={fp.confirm}
                  onChange={(e) => {
                    fp.setConfirm(e.target.value);
                    fp.setErrors((p) => ({ ...p, confirm: null }));
                  }}
                  error={fp.errors.confirm}
                  autoComplete="new-password"
                  placeholder="Confirm your new Password"
                  disabled={fp.loading}
                />
                {resetConfirmTouched && (
                  <p
                    className={resetPasswordsMatch ? styles.matchSuccess : styles.matchError}
                    role={resetPasswordsMismatch ? 'alert' : 'status'}
                  >
                    {resetPasswordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
                  </p>
                )}
              </div>

              <div className={styles.submitRow}>
                <PillButton
                  type="submit"
                  loading={fp.loading}
                  disabled={!fp.password || !fp.confirm || resetPasswordsMismatch}
                >
                  {t('resetButton', 'Change Password')}
                </PillButton>
              </div>
            </form>
          </>
        )}

        {/* ── Stage 4: Success ── */}
        {fp.stage === 'done' && (
          <div className={styles.successWrapper}>
            <motion.div
              className={styles.successIconCircle}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            >
              <MdLockReset size={36} aria-hidden="true" />
            </motion.div>
            <h2 className={styles.successTitle}>{t('successTitle')}</h2>
            <p className={styles.successSub}>{t('successSubtitle')}</p>
            <PillButton onClick={() => navigate('/login')}>
              {t('goToLogin')}
            </PillButton>
          </div>
        )}

      </motion.div>
    </AnimatePresence>
  );
}
