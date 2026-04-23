import styles from './FeaturesSection.module.css';

const FEATURES = [
  { id: 1, alt: 'Feature placeholder 1' },
  { id: 2, alt: 'Feature placeholder 2' },
  { id: 3, alt: 'Feature placeholder 3' },
];

function FeatureCard({ alt }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardImage}>
        <img
          src="https://placehold.co/400x520/AAAAAA/AAAAAA"
          alt={alt}
          className={styles.cardImg}
          width="400"
          height="520"
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
    </div>
  );
}

export default function FeaturesSection() {
  return (
    <section aria-labelledby="features-heading" className={styles.section}>
      <div className={styles.inner}>
        <h2 id="features-heading" className={styles.sectionTitle}>
          Loream Ipsum
        </h2>
        <p className={styles.sectionSub}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Morbi rutrum sed magna id mollis.
        </p>

        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <FeatureCard key={f.id} alt={f.alt} />
          ))}
        </div>
      </div>
    </section>
  );
}