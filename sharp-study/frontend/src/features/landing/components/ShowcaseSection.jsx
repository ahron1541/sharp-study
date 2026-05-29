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
          Upload learning materials, build study guides, review with flashcards
          and quizzes, listen with narrator support, and adjust contrast or text
          size from the same workspace.
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
            src="https://cdn.undraw.co/illustrations/social-dashboard_81sv.svg"
            alt="Illustration of a dashboard workspace for study tools"
            className={styles.showcaseImg}
            width="800"
            height="500"
            loading="lazy"
          />
        </motion.div>
      </div>
    </section>
  );
}
