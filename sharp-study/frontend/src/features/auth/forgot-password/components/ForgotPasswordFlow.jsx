import { useState } from 'react';
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

  const {
    otp, setOtp,
    cooldown, error: otpHookError, setError: setOtpError,
    sending: otpSending,
    sendOTP: resendResetOTP,
  } = useOTP(requestPasswordResetOTP, verifyPasswordResetOTP, fp.resolvedEmail);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
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

            <form
              onSubmit={(e) => { e.preventDefault(); fp.requestOTP(); }}
              noValidate
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
                  error={fp.errors.identifier}
                  rightAddon={{
                    label:    'Send',
                    ariaLabel: 'Send reset code',
                    onClick:  (e) => { e.preventDefault(); fp.requestOTP(); },
                    disabled: fp.loading,
                  }}
                />
              </div>
            </form>

            <div className={styles.backLinkRow}>
              <Link to="/login" className={styles.backLink}>
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
              <p className={styles.subtitle}>{t('otpSubtitle')}</p>
            </div>

            <form onSubmit={handleVerifyOTP} noValidate>
              <div className={styles.fields}>
                <p className={styles.otpLabel}>Enter the 6-digit reset code</p>

                <OTPInput
                  value={otp}
                  onChange={setOtp}
                  error={!!(otpHookError || fp.errors.otp)}
                  disabled={fp.loading}
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
                    disabled={otp.replace(/\D/g, '').length < 6}
                  >
                    {t('verifyOTP')}
                  </PillButton>
                </div>

                <button
                  type="button"
                  onClick={resendResetOTP}
                  disabled={cooldown > 0 || otpSending}
                  className={styles.resendBtn}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
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

            <form
              onSubmit={(e) => { e.preventDefault(); fp.submitNewPassword(); }}
              noValidate
            >
              <div className={styles.fields}>
                {/*
                  Greyed-out username display — matches Account_Recovery_1_2 wireframe.
                  The "Username" field is shown as disabled/locked.
                */}
                <PillInput
                  id="fp-username-display"
                  label="Username"
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
                />
              </div>

              <div className={styles.submitRow}>
                <PillButton type="submit" loading={fp.loading}>
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