import { motion } from 'framer-motion';
import styles from './ShowcaseSection.module.css';

export default function ShowcaseSection() {
  return (
    <section aria-labelledby="showcase-heading" className={styles.section}>
      <div className={styles.inner}>
        <h2 id="showcase-heading" className={styles.sectionTitle}>
          A focused workspace from upload to review
        </h2>
        <p className={styles.sectionSub}>
          Upload learning materials, edit your notes manually, listen with the
          narrator, and let the admin dashboard keep users and content managed
          securely.
        </p>

        <motion.div
          className={styles.imageWrapper}
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.34, ease: 'easeOut' }}
        >
          <div className={styles.skeleton} aria-hidden="true" />
          <img
            src="https://placehold.co/900x560/eaf7ef/183b2a.svg?text=Verso+Dashboard+Preview"
            alt="Verso dashboard preview placeholder"
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
        </motion.div>
      </div>
    </section>
  );
}
