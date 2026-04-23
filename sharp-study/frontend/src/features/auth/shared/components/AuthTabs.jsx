import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './AuthTabs.module.css';

/**
 * Login / Signup tab switcher.
 * Navigates to /login or /register when a tab is clicked.
 *
 * Props:
 *   activeTab — 'login' | 'signup'
 */
export default function AuthTabs({ activeTab }) {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');

  return (
    <div className={styles.container}>
      <div role="tablist" aria-label="Authentication options" className={styles.tabBar}>
        <button
          role="tab"
          aria-selected={activeTab === 'login'}
          aria-controls="auth-panel"
          onClick={() => navigate('/login')}
          className={`${styles.tab} ${activeTab === 'login' ? styles.active : ''}`}
        >
          {t('tabs.login', 'Login')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'signup'}
          aria-controls="auth-panel"
          onClick={() => navigate('/register')}
          className={`${styles.tab} ${activeTab === 'signup' ? styles.active : ''}`}
        >
          {t('tabs.signup', 'Sign Up')}
        </button>
      </div>
    </div>
  );
}