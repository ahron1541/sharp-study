import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { sanitizePlainText }          from '../../../../shared/utils/sanitize';
import { validators }                 from '../../../../shared/utils/validators';
import PillInput      from '../../shared/components/PillInput';
import styles         from './Step1EmailOTP.module.css';

export default function Step1EmailOTP({ onContinue, sending = false }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup.step1' });
  const [email,      setEmail]      = useState('');
  const [emailError, setEmailError] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const sanitizedEmail = sanitizePlainText(email).toLowerCase().trim();
    const err = validators.email(sanitizedEmail);
    if (err) { setEmailError(err); return; }
    setEmailError('');
    onContinue(sanitizedEmail);
  };

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>
      </div>

      <form onSubmit={handleEmailSubmit} noValidate>
        <div className={styles.fields}>
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
              label: sending ? <span className={styles.inlineLoader}><span className={styles.inlineSpinner} aria-hidden="true" />{t('sendPending')}</span> : t('submit'),
              ariaLabel: 'Send verification code',
              onClick: handleEmailSubmit,
              disabled: sending,
            }}
          />
          <p className={styles.helperText}>
            {t('helper')}
          </p>
        </div>
      </form>
    </motion.div>
  );
}
