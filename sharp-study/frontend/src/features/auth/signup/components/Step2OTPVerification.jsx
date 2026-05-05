import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AiOutlineWarning } from 'react-icons/ai';
import { MdOutlineMarkEmailRead } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import OTPInput from '../../otp/components/OTPInput';
import PillButton from '../../shared/components/PillButton';
import { requestSignupOTP, verifySignupOTP } from '../../shared/services/auth.service';
import { useOTP } from '../../otp/hooks/useOTP';
import styles from './Step2OTPVerification.module.css';

export default function Step2OTPVerification({ email, onBack, onVerified }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup.otpStep' });
  const autoSendRef = useRef(false);

  const {
    otp,
    setOtp,
    otpSent,
    sending,
    verifying,
    cooldown,
    error,
    sendOTP,
    verifyOTP,
  } = useOTP(requestSignupOTP, verifySignupOTP, email);

  useEffect(() => {
    if (!email || autoSendRef.current) return;
    autoSendRef.current = true;
    sendOTP();
  }, [email, sendOTP]);

  const handleVerify = async (event) => {
    event.preventDefault();
    const response = await verifyOTP();
    if (response?.signup_token) {
      onVerified(response.signup_token);
    }
  };

  const isBooting = sending && !otpSent;

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>
          {t('subtitle')} <strong>{email}</strong>
        </p>
      </div>

      {isBooting ? (
        <div className={styles.skeletonCard} aria-live="polite">
          <div className={styles.skeletonGlow} />
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonOtp} />
          <div className={styles.skeletonOtp} />
          <div className={styles.skeletonButton} />
        </div>
      ) : (
        <form onSubmit={handleVerify} noValidate>
          <div className={styles.fields}>
            <div className={styles.lockedRow} aria-label={`Sending code to ${email}`}>
              <MdOutlineMarkEmailRead size={18} className={styles.lockedIcon} aria-hidden="true" />
              <span className={styles.lockedText}>{email}</span>
              <span className={styles.lockedBadge}>{otpSent ? t('statusSent') : t('statusWaiting')}</span>
            </div>

            <div>
              <p className={styles.otpLabel}>{t('otpLabel')}</p>
              <OTPInput
                value={otp}
                onChange={setOtp}
                error={!!error}
                disabled={verifying || sending}
              />
              <AnimatePresence>
                {error && (
                  <motion.p
                    role="alert"
                    className={styles.otpError}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    <AiOutlineWarning size={13} aria-hidden="true" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className={styles.otpMeta}>
                Code expires in {import.meta.env.VITE_OTP_EXPIRY_MINUTES ?? 10} minutes
              </p>
            </div>

            <div className={styles.actionRow}>
              <button type="button" onClick={onBack} className={styles.backBtn}>
                {t('changeEmail')}
              </button>
              <PillButton type="submit" loading={verifying} disabled={otp.replace(/\D/g, '').length < 6 || sending}>
                {t('verifyButton')}
              </PillButton>
            </div>

            <button
              type="button"
              onClick={sendOTP}
              disabled={cooldown > 0 || sending}
              className={styles.resendBtn}
            >
              {cooldown > 0 ? t('resendCooldown', { seconds: cooldown }) : t('resend')}
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}
