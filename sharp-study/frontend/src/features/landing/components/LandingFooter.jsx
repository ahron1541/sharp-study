import { Link } from 'react-router-dom';
import styles from './LandingFooter.module.css';

const COL_A = [
  { label: 'Study Guides', href: '/register' },
  { label: 'Flashcards', href: '/register' },
  { label: 'Quizzes', href: '/register' },
  { label: 'Narrator Tools', href: '/register' },
];

const COL_B = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Accessibility', href: '/register' },
  { label: 'Admin Dashboard', href: '/login' },
];

export default function LandingFooter() {
  return (
    <footer role="contentinfo" className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.footerLabel}>Verso learning platform</p>

        <div className={styles.grid}>
          {/* Logo / brand — matches wireframe bottom-left image box */}
          <div className={styles.logoCol}>
            <div className={styles.logoImg}>
              <img
                src="/src/assets/logo/verso_logo.svg"
                alt="Verso logo"
                className={styles.logoPlaceholder}
                loading="lazy"
              />
            </div>
          </div>

          {/* Link columns */}
          <nav aria-label="Footer navigation column 1" className={styles.linkCol}>
            {COL_A.map((item, i) => (
              <Link key={i} to={item.href} className={styles.link}>
                {item.label}
              </Link>
            ))}
          </nav>

          <nav aria-label="Footer navigation column 2" className={styles.linkCol}>
            {COL_B.map((item, i) => (
              <Link key={i} to={item.href} className={styles.link}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
