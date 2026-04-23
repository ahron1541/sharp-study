import { Link } from 'react-router-dom';
import styles from './LandingFooter.module.css';

const COL_A = [
  { label: 'Website Content', href: '#' },
  { label: 'Website Content', href: '#' },
  { label: 'Website Content', href: '#' },
  { label: 'Website Content', href: '#' },
];

const COL_B = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Website Content', href: '#' },
  { label: 'Website Content', href: '#' },
];

export default function LandingFooter() {
  return (
    <footer role="contentinfo" className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.footerLabel}>Footer</p>

        <div className={styles.grid}>
          {/* Logo / brand placeholder — matches wireframe bottom-left image box */}
          <div className={styles.logoCol}>
            <div className={styles.logoImg}>
              <img
                src="https://placehold.co/200x130/AAAAAA/AAAAAA"
                alt="Sharp Study logo placeholder"
                className={styles.logoPlaceholder}
                width="200"
                height="130"
                loading="lazy"
              />
              <svg
                className={styles.cross}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
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