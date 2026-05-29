import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAccessibility } from '../../../accessibility/context/useAccessibility';
import styles from './AuthLayout.module.css';
import backButtonDark from '../../../../assets/icons/buttons/back_button_dark_mode.svg';
import backButtonLight from '../../../../assets/icons/buttons/back_button_light_mode.svg';

const defaultAuthImage = 'https://cdn.undraw.co/illustrations/secure-login_m11a.svg';
const defaultImageTitle = 'Welcome back to your study space.';
const defaultImageSubtitle = 'Keep your guides, cards, quizzes, and progress close by.';

/**
 * Two-column auth card layout.
 * Left: image panel (visible on desktop only).
 * Right: back button + form content.
 *
 * Usage:
 *   <AuthLayout>
 *     <LoginForm />
 *   </AuthLayout>
 */
export default function AuthLayout({
  children,
  busy = false,
  busyLabel = 'Preparing your workspace...',
  imageSrc = defaultAuthImage,
  imageTitle = defaultImageTitle,
  imageSubtitle = defaultImageSubtitle,
}) {
  const navigate = useNavigate();
  const { theme } = useAccessibility();
  const backIcon = theme === 'dark' ? backButtonDark : backButtonLight;

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <aside className={styles.imagePanel} aria-hidden="true">
          <img
            src={imageSrc}
            alt=""
            className={styles.authImage}
            width="720"
            height="900"
          />
          <div className={styles.imageCaption}>
            <p className={styles.imageCaptionTitle}>{imageTitle}</p>
            <p className={styles.imageCaptionSub}>{imageSubtitle}</p>
          </div>
        </aside>

        <main className={styles.formPanel}>
          <button
            onClick={() => navigate('/')}
            disabled={busy}
            className={styles.backBtn}
            aria-label="Back to landing page"
          >
            <img src={backIcon} alt="" aria-hidden="true" className={styles.backIcon} />
          </button>

          <motion.div
            className={styles.formContent}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>

      </div>
      {busy && (
        <div className={styles.busyOverlay} role="alert" aria-live="assertive" aria-busy="true">
          <div className={styles.busyCard}>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} />
            </div>
            <p className={styles.busyTitle}>{busyLabel}</p>
            <p className={styles.busyText}>Please wait a moment. Actions are locked to keep your account safe.</p>
            <div className={styles.busySkeleton} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
