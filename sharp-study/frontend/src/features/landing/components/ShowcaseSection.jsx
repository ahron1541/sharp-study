import styles from './ShowcaseSection.module.css';

export default function ShowcaseSection() {
  return (
    <section aria-labelledby="showcase-heading" className={styles.section}>
      <div className={styles.inner}>
        <h2 id="showcase-heading" className={styles.sectionTitle}>
          Loream Ipsum
        </h2>
        <p className={styles.sectionSub}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Morbi rutrum sed magna id mollis.
        </p>

        <div className={styles.imageWrapper}>
          <img
            src="https://placehold.co/800x500/AAAAAA/AAAAAA"
            alt="Application showcase — placeholder"
            className={styles.showcaseImg}
            width="800"
            height="500"
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
    </section>
  );
}