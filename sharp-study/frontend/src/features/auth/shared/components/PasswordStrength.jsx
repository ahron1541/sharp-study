import { useMemo } from 'react';
import { AiOutlineCheck, AiOutlineClose } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import {
  MIN_PASSWORD_LENGTH,
  MIN_PASSWORD_SCORE,
  PASSWORD_REQUIREMENTS,
  getPasswordScore,
} from '../utils/passwordPolicy';
import styles from './PasswordStrength.module.css';

function getRequirements(t) {
  return PASSWORD_REQUIREMENTS.map((rule) => ({
    ...rule,
    label: t(`password.requirements.${rule.key}`),
  }));
}

const LEVEL_COLORS = ['level1', 'level2', 'level3', 'level4', 'level5'];

export default function PasswordStrength({ password = '', id }) {
  const { t } = useTranslation('auth');
  const requirements = useMemo(() => getRequirements(t), [t]);
  const levels = t('password.strength.levels', { returnObjects: true });

  const metCount = getPasswordScore(password);
  const showBar  = password.length > 0;
  const strengthIndex = Math.max(0, metCount - 1);

  return (
    <div id={id} aria-live="polite" aria-label={t('password.strength.label')}>
      {/* Strength bar (only visible once user starts typing) */}
      {showBar && (
        <>
          <div className={styles.bar} role="presentation">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`${styles.segment} ${i < metCount ? styles[LEVEL_COLORS[metCount - 1]] : ''}`}
              />
            ))}
          </div>
          <p className={styles.strengthLabel}>
            {password.length > 0 && levels[strengthIndex]}
          </p>
        </>
      )}

      <p className={styles.policyHint}>
        {t('password.requirements.policyHint', {
          score: MIN_PASSWORD_SCORE,
          total: requirements.length,
          min: MIN_PASSWORD_LENGTH,
        })}
      </p>

      {/* Requirements checklist */}
      <ul className={styles.list} aria-label="Password requirements">
        {requirements.map((req) => {
          const met = req.test(password);
          return (
            <li key={req.key} className={`${styles.item} ${met ? styles.met : ''}`}>
              {met
                ? <AiOutlineCheck className={styles.icon} aria-hidden="true" />
                : <AiOutlineClose className={styles.icon} aria-hidden="true" />}
              <span>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
