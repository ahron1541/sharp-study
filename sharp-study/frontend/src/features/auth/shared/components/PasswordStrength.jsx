import { useMemo } from 'react';
import { AiOutlineCheck, AiOutlineClose } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import styles from './PasswordStrength.module.css';

function getRequirements(t) {
  return [
    { key: 'length',   label: t('password.requirements.length'),   test: (v) => v.length >= 12 },
    { key: 'upper',    label: t('password.requirements.uppercase'), test: (v) => /[A-Z]/.test(v) },
    { key: 'lower',    label: t('password.requirements.lowercase'), test: (v) => /[a-z]/.test(v) },
    { key: 'number',   label: t('password.requirements.number'),    test: (v) => /[0-9]/.test(v) },
    { key: 'special',  label: t('password.requirements.special'),   test: (v) => /[^A-Za-z0-9]/.test(v) },
  ];
}

const LEVEL_COLORS = ['level1', 'level2', 'level3', 'level4', 'level5'];

export default function PasswordStrength({ password = '', id }) {
  const { t } = useTranslation('auth');
  const requirements = useMemo(() => getRequirements(t), [t]);
  const levels = t('password.strength.levels', { returnObjects: true });

  const metCount = requirements.filter((r) => r.test(password)).length;
  const showBar  = password.length > 0;

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
            {password.length > 0 && levels[metCount - 1]}
          </p>
        </>
      )}

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