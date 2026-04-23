import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AiOutlineWarning, AiOutlineMail } from 'react-icons/ai';
import { MdOutlineMarkEmailRead } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { sanitizePlainText }          from '../../../../shared/utils/sanitize';
import { validators }                 from '../../../../shared/utils/validators';
import { requestSignupOTP, verifySignupOTP } from '../../shared/services/auth.service';
import { useOTP }     from '../../otp/hooks/useOTP';
import OTPInput       from '../../otp/components/OTPInput';
import PillInput      from '../../shared/components/PillInput';
import PillButton     from '../../shared/components/PillButton';
import styles         from './Step1EmailOTP.module.css';

export default function Step1EmailOTP({ onVerified }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup.step1' });
  const [email,      setEmail]      = useState('');
  const [emailError, setEmailError] = useState('');

  const {
    otp, setOtp, otpSent,
    sending, verifying,
    cooldown, error: otpError,
    sendOTP, verifyOTP,
  } = useOTP(requestSignupOTP, verifySignupOTP, email);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const err = validators.email(sanitizePlainText(email));
    if (err) { setEmailError(err); return; }
    setEmailError('');
    await sendOTP();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const ok = await verifyOTP();
    if (ok) onVerified(email.toLowerCase().trim());
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{otpSent ? t('otpTitle') : t('title')}</h1>
        <p className={styles.subtitle}>
          {otpSent
            ? <>{t('otpSubtitle')} <strong>{email}</strong></>
            : t('subtitle')}
        </p>
      </div>

      {!otpSent ? (
        /* ── Email entry form ── */
        <form onSubmit={handleEmailSubmit} noValidate>
          <div className={styles.fields}>
            {/*
              Email input with "Send" as an inline right button —
              matches the wireframe (Email Address | Send)
            */}
            <PillInput
              id="signup-email"
              label={t('emailLabel')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
              placeholder="Enter your Email Address"
              required
              error={emailError}
              rightAddon={{
                label:    'Send',
                ariaLabel: 'Send verification code',
                onClick:  handleEmailSubmit,
                disabled: sending,
              }}
            />
          </div>
        </form>
      ) : (
        /* ── OTP verification ── */
        <form onSubmit={handleVerify} noValidate>
          <div className={styles.fields}>
            {/* Locked email display */}
            <div className={styles.lockedRow} aria-label={`Sending code to ${email}`}>
              <MdOutlineMarkEmailRead
                size={18}
                className={styles.lockedIcon}
                aria-hidden="true"
              />
              <span className={styles.lockedText}>{email}</span>
              <span className={styles.lockedBadge}>Sent</span>
            </div>

            {/* Segmented OTP input */}
            <div>
              <p className={styles.otpLabel} id="otp-group-label">
                {t('otpLabel')}
              </p>
              <OTPInput
                value={otp}
                onChange={setOtp}
                error={!!otpError}
                disabled={verifying}
              />
              <AnimatePresence>
                {otpError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className={styles.otpError}
                  >
                    <AiOutlineWarning size={13} aria-hidden="true" />
                    {otpError}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className={styles.otpMeta}>
                Code expires in {import.meta.env.VITE_OTP_EXPIRY_MINUTES ?? 10} minutes
              </p>
            </div>

            <PillButton type="submit" loading={verifying} disabled={otp.length < 6}>
              {t('verifyButton')}
            </PillButton>

            <button
              type="button"
              onClick={sendOTP}
              disabled={cooldown > 0 || sending}
              className={styles.resendBtn}
              aria-disabled={cooldown > 0}
            >
              {cooldown > 0
                ? t('resendCooldown', { seconds: cooldown })
                : t('resend')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}