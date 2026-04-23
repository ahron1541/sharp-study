import { Link } from 'react-router-dom';
import { MdMenuBook, MdLightMode, MdDarkMode } from 'react-icons/md';
import { useAccessibility } from '../../../features/accessibility/context/AccessibilityContext';
import styles from './LandingNav.module.css';

export default function LandingNav() {
  const { theme, toggleTheme } = useAccessibility();

  return (
    <header role="banner">
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.inner}>
          {/* Logo */}
          <Link to="/" className={styles.logo} aria-label="Sharp Study — Home">
            <span className={styles.logoIcon} aria-hidden="true">
              <MdMenuBook size={24} />
            </span>
            <span>
              SHARP<span className={styles.logoAccent}>STUDY</span>
            </span>
          </Link>

          {/* Right actions */}
          <div className={styles.actions}>
            {/* Theme toggle — matching the moon/sun icon in wireframe */}
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className={styles.themeBtn}
            >
              {theme === 'light'
                ? <MdDarkMode  size={18} aria-hidden="true" />
                : <MdLightMode size={18} aria-hidden="true" />}
            </button>

            <Link to="/login" className={styles.loginBtn}>
              <span className={styles.loginBtnText}>Login</span>
            </Link>

            <Link to="/register" className={styles.signupBtn}>
              <span className={styles.signupBtnText}>Sign Up</span>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}