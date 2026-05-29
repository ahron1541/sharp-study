import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './HeroSection.module.css';

const studyGuideSvg = 'https://cdn.undraw.co/illustrations/studying_n5uj.svg';
const narratorSvg = 'https://cdn.undraw.co/illustration/voice-messages_anpq.svg';

function HeroImage({ className, src }) {
  return (
    <div className={className}>
      <div className={styles.skeleton} aria-hidden="true" />
      <img
        src={src}
        alt=""
        className={styles.heroImg}
        width="600"
        height="400"
        loading="lazy"
      />
    </div>
  );
}

export default function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className={styles.section}>
      <div className={styles.inner}>

        <motion.div
          className={styles.textCol}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.34, ease: 'easeOut' }}
        >
          <p className={styles.eyebrow}>Accessible AI learning for every student</p>
          <h1 id="hero-heading" className={styles.headline}>
            Turn difficult lessons into study steps you can manage.
          </h1>
          <p className={styles.subheadline}>
            Verso turns long readings, slides, and class files into clear guides,
            flashcards, quizzes, and voice-ready review so studying feels less
            overwhelming.
          </p>
          <div className={styles.ctaRow}>
            <Link to="/register" className={styles.ctaBtn}>
              Get started
            </Link>
          </div>
          <div className={styles.statRow} aria-label="Verso highlights">
            <span>Readable guides</span>
            <span>Active recall</span>
            <span>Voice-ready</span>
          </div>
        </motion.div>

        <motion.div
          className={styles.imageCol}
          aria-hidden="true"
          initial={{ opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.38, ease: 'easeOut', delay: 0.08 }}
        >
          <HeroImage className={styles.imageFront} src={studyGuideSvg} />
          <HeroImage className={styles.imageBack} src={narratorSvg} />
        </motion.div>

      </div>
    </section>
  );
}
