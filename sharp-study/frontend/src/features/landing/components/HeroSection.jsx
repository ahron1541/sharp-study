import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './HeroSection.module.css';

const studyGuideSvg = 'https://placehold.co/620x420/eaf7ef/1f4d3a.svg?text=Readable+Study+Guide';
const narratorSvg = 'https://placehold.co/620x420/fff4d8/3b2f14.svg?text=Voice+Narrator';

function PlaceholderBox({ className, ariaLabel, src }) {
  return (
    <div className={className}>
      <div className={styles.skeleton} aria-hidden="true" />
      <img
        src={src}
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
        <motion.div
          className={styles.textCol}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.34, ease: 'easeOut' }}
        >
          <p className={styles.eyebrow}>Accessible AI learning for every student</p>
          <h1 id="hero-heading" className={styles.headline}>
            Study long lessons in a clearer, calmer way.
          </h1>
          <p className={styles.subheadline}>
            Verso turns school documents into short study guides, flashcards,
            quizzes, and spoken lessons built for students with low vision,
            dyslexia, ADHD, and other learning needs.
          </p>
          <div className={styles.ctaRow}>
            <Link to="/register" className={styles.ctaBtn}>
              Get started
            </Link>
          </div>
          <div className={styles.statRow} aria-label="Verso highlights">
            <span>High contrast</span>
            <span>Large text</span>
            <span>Voice-ready</span>
          </div>
        </motion.div>

        {/* Right: stacked image placeholders */}
        <motion.div
          className={styles.imageCol}
          aria-hidden="true"
          initial={{ opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.38, ease: 'easeOut', delay: 0.08 }}
        >
          <PlaceholderBox className={styles.imageFront} src={studyGuideSvg} />
          <PlaceholderBox className={styles.imageBack} src={narratorSvg} />
        </motion.div>

      </div>
    </section>
  );
}
