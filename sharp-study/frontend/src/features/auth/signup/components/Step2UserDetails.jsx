import { AiOutlineUser, AiOutlineCheck, AiOutlineClose, AiOutlineWarning } from 'react-icons/ai';
import { useTranslation }   from 'react-i18next';
import PillInput            from '../../shared/components/PillInput';
import PasswordInput        from '../../shared/components/PasswordInput';
import PasswordStrength     from '../../shared/components/PasswordStrength';
import PillButton           from '../../shared/components/PillButton';
import { useSignupForm }    from '../hooks/useSignupForm';
import styles               from './Step2UserDetails.module.css';

export default function Step2UserDetails({ email, onSuccess }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup.step2' });
  const { form, update, errors, loading, usernameStatus, submit } = useSignupForm(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await submit();
    if (ok) onSuccess();
  };

  /* Username right icon based on availability status */
  const usernameRightIcon = () => {
    if (usernameStatus === 'checking') {
      return (
        <span
          style={{
            width: '1rem', height: '1rem',
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            display: 'inline-block',
          }}
          aria-label="Checking username availability"
        />
      );
    }
    if (usernameStatus === 'available') {
      return <AiOutlineCheck size={18} style={{ color: '#22C55E' }} aria-label="Available" />;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      return <AiOutlineClose size={18} style={{ color: '#EF4444' }} aria-label="Not available" />;
    }
    return null;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>
          Setting up account for <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.fields}>
          {/* First + Last name grid */}
          <div className={styles.nameGrid}>
            <PillInput
              id="first-name"
              label={t('firstName')}
              type="text"
              autoComplete="given-name"
              value={form.first_name}
              onChange={(e) => update('first_name', e.target.value)}
              placeholder="Juan"
              required
              error={errors.first_name}
            />
            <PillInput
              id="last-name"
              label={t('lastName')}
              type="text"
              autoComplete="family-name"
              value={form.last_name}
              onChange={(e) => update('last_name', e.target.value)}
              placeholder="dela Cruz"
              required
              error={errors.last_name}
            />
          </div>

          {/* Middle name */}
          <PillInput
            id="middle-name"
            label={`${t('middleName')} ${t('middleNameOptional')}`}
            type="text"
            autoComplete="additional-name"
            value={form.middle_name}
            onChange={(e) => update('middle_name', e.target.value)}
            placeholder="Optional"
          />

          {/* Username with live availability icon */}
          <div>
            <PillInput
              id="username"
              label={t('username')}
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              placeholder="juana_dc"
              required
              error={errors.username}
              rightIcon={usernameRightIcon()}
              aria-invalid={
                errors.username || usernameStatus === 'taken' || usernameStatus === 'invalid'
              }
              describedBy="username-status"
            />
            <p
              id="username-status"
              aria-live="polite"
              className={
                usernameStatus === 'available'
                  ? styles.statusAvailable
                  : usernameStatus === 'taken' || usernameStatus === 'invalid'
                    ? styles.statusError
                    : styles.statusHint
              }
            >
              {usernameStatus === 'available' && t('usernameAvailable')}
              {usernameStatus === 'taken'     && t('usernameTaken')}
              {usernameStatus === 'checking'  && t('usernameChecking')}
              {usernameStatus === 'invalid'   && 'Only letters, numbers, _ . - are allowed.'}
              {!usernameStatus && t('usernameHint')}
            </p>
          </div>

          {/* Password */}
          <PasswordInput
            id="reg-password"
            label={t('password')}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            error={errors.password}
            autoComplete="new-password"
            describedBy="pw-strength"
          />
          <PasswordStrength password={form.password} id="pw-strength" />

          {/* Confirm password */}
          <PasswordInput
            id="reg-confirm"
            label={t('confirmPassword')}
            value={form.confirm_password}
            onChange={(e) => update('confirm_password', e.target.value)}
            error={errors.confirm_password}
            autoComplete="new-password"
          />
        </div>

        <div className={styles.submitRow}>
          <PillButton type="submit" loading={loading}>
            {t('submit')}
          </PillButton>
        </div>
      </form>
    </div>
  );
}