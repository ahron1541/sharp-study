import { Link } from 'react-router-dom';
import styles from './HeroSection.module.css';

function PlaceholderBox({ className, ariaLabel }) {
  return (
    <div className={className}>
      <img
        src="https://placehold.co/600x400/AAAAAA/AAAAAA"
        alt={ariaLabel || ''}
        aria-hidden={!ariaLabel}
        className={styles.placeholderImg}
        width="600"
        height="400"
        loading="lazy"
      />
      <svg
        className={styles.cross}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className={styles.section}>
      <div className={styles.inner}>

        {/* Left: headline + CTA */}
        <div className={styles.textCol}>
          <h1 id="hero-heading" className={styles.headline}>
            Lorem Ipsum
          </h1>
          <p className={styles.subheadline}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Morbi rutrum sed magna id mollis. Pellentesque ut diam nisl.
            Fusce et ligula ipsum. Aenean egestas erat vitae pretium mattis.
          </p>
          <Link to="/register" className={styles.ctaBtn}>
            Join for free
          </Link>
        </div>

        {/* Right: stacked image placeholders */}
        <div className={styles.imageCol} aria-hidden="true">
          <PlaceholderBox className={styles.imageFront} />
          <PlaceholderBox className={styles.imageBack} />
        </div>

      </div>
    </section>
  );
}