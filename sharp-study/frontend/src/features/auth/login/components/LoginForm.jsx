import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AiOutlineWarning } from 'react-icons/ai';
import { MdLockOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useLoginForm }  from '../hooks/useLoginForm';
import AuthTabs          from '../../shared/components/AuthTabs';
import PillInput         from '../../shared/components/PillInput';
import PasswordInput     from '../../shared/components/PasswordInput';
import PillButton        from '../../shared/components/PillButton';
import styles            from './LoginForm.module.css';

export default function LoginForm({ sessionTimeout = false }) {
  const { t } = useTranslation('auth', { keyPrefix: 'login' });
  const {
    identifier, setIdentifier,
    password,   setPassword,
    rememberMe, setRememberMe,
    errors, loading, lockInfo,
    clearFieldError, submit,
  } = useLoginForm();

  return (
    <div className={styles.wrapper}>

      {/* Tab switcher — Login active */}
      <AuthTabs activeTab="login" />

      {/* Heading */}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>
      </div>

      {/* Session timeout notice */}
      <AnimatePresence>
        {sessionTimeout && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className={styles.alertWarning}
          >
            <AiOutlineWarning size={16} aria-hidden="true" />
            You were logged out due to inactivity. Please log in again.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account lockout notice */}
      <AnimatePresence>
        {lockInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className={styles.alertDanger}
          >
            <MdLockOutline size={16} aria-hidden="true" />
            {lockInfo}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form-level error */}
      <AnimatePresence>
        {errors.form && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className={styles.alertDanger}
          >
            <AiOutlineWarning size={16} aria-hidden="true" />
            {errors.form}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fields */}
      <form
        id="auth-panel"
        onSubmit={submit}
        noValidate
        aria-label={t('subtitle')}
      >
        <div className={styles.fields}>
          {/* Username or email */}
          <PillInput
            id="login-identifier"
            label={t('emailLabel')}
            type="text"
            autoComplete="username email"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              clearFieldError('identifier');
            }}
            placeholder={t('emailPlaceholder', 'Enter your username')}
            required
            error={errors.identifier}
          />

          {/* Password */}
          <div>
            <PasswordInput
              id="login-password"
              label={t('passwordLabel')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              error={errors.password}
              autoComplete="current-password"
              required
            />
          </div>

          {/* Remember me + Forgot password */}
          <div className={styles.bottomRow}>
            <label className={styles.rememberRow}>
              <input
                type="checkbox"
                id="remember-me"
                className={styles.checkbox}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className={styles.checkboxLabel}>{t('rememberMe')}</span>
            </label>

            <Link to="/forgot-password" className={styles.forgotLink}>
              {t('forgotPassword')}
            </Link>
          </div>
        </div>

        {/* Submit — right-aligned pill button matching wireframe */}
        <div className={styles.submitRow}>
          <PillButton
            type="submit"
            loading={loading}
            className={styles.submitBtn}
            ariaLabel={t('submit')}
          >
            {t('submit')}
          </PillButton>
        </div>
      </form>
    </div>
  );
}