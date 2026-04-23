import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MdCheckCircleOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import PillButton from '../../shared/components/PillButton';
import styles from './Step3Success.module.css';

const REDIRECT_SECONDS = 5;

export default function Step3Success() {
  const { t } = useTranslation('auth', { keyPrefix: 'signup.step3' });
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(interval); navigate('/login'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  const circumference = 2 * Math.PI * 22;

  return (
    <div className={styles.wrapper}>
      <motion.div
        className={styles.iconCircle}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <MdCheckCircleOutline size={48} aria-hidden="true" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className={styles.content}
      >
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>

        <div className={styles.countdown} aria-hidden="true">
          <svg width="60" height="60">
            <circle cx="30" cy="30" r="22" fill="none" stroke="var(--card-border)" strokeWidth="4" />
            <circle
              cx="30" cy="30" r="22" fill="none"
              stroke="var(--accent)" strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - seconds / REDIRECT_SECONDS)}
              strokeLinecap="round"
              transform="rotate(-90 30 30)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
            <text x="30" y="35" textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--accent)">
              {seconds}
            </text>
          </svg>
        </div>

        <p aria-live="polite" className={styles.redirectMsg}>
          {t('redirecting', { seconds })}
        </p>

        <PillButton variant="secondary" onClick={() => navigate('/login')}>
          {t('goToLogin')}
        </PillButton>
      </motion.div>
    </div>
  );
}