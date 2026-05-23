import { Link } from 'react-router-dom';
import styles from './LandingFooter.module.css';
import versoLogo from '../../../assets/logo/verso_logo.svg';

const FOOTER_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
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
                src={versoLogo}
                alt="Verso logo"
                className={styles.logoPlaceholder}
                loading="lazy"
              />
            </div>
          </div>

          <nav aria-label="Footer navigation" className={styles.linkCol}>
            {FOOTER_LINKS.map((item, i) => (
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
