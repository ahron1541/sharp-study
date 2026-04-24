import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAccessibility } from '../../../accessibility/context/AccessibilityContext';
import styles from './AuthLayout.module.css';
import backButtonDark from '../../../../assets/icons/buttons/back_button_dark_mode.svg';
import backButtonLight from '../../../../assets/icons/buttons/back_button_light_mode.svg';

/**
 * Two-column auth card layout.
 * Left: image placeholder panel (visible on desktop only).
 * Right: back button + form content.
 *
 * Usage:
 *   <AuthLayout>
 *     <LoginForm />
 *   </AuthLayout>
 */
export default function AuthLayout({ children }) {
  const navigate = useNavigate();
  const { theme } = useAccessibility();
  const backIcon = theme === 'dark' ? backButtonDark : backButtonLight;

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Left: image placeholder panel ── */}
        <aside className={styles.imagePanel} aria-hidden="true">
          {/*
            Replace this img src with your actual illustration later.
            The placehold.co URL generates a gray placeholder matching the wireframe.
          */}
          <img
            src="https://placehold.co/720x900/AAAAAA/AAAAAA"
            alt=""
            className={styles.placeholderImage}
            width="720"
            height="900"
          />
          {/* X lines overlay — matching the wireframe crossed-box placeholder */}
          <svg
            className={styles.imageCross}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className={styles.imageCaption}>
            <p className={styles.imageCaptionTitle}>Study smarter, not harder</p>
            <p className={styles.imageCaptionSub}>AI-powered study tools for every learner</p>
          </div>
        </aside>

        {/* ── Right: form panel ── */}
        <main className={styles.formPanel}>
          {/* Back button — top left of the right panel */}
          <button
            onClick={() => navigate(-1)}
            className={styles.backBtn}
            aria-label="Go back"
          >
            <img src={backIcon} alt="" className={styles.backIcon} />
          </button>

          {/* Animated form content */}
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
    </div>
  );
}