import { motion } from 'framer-motion';
import styles from './FeaturesSection.module.css';

const FEATURES = [
  {
    id: 1,
    title: 'Readable Study Guides',
    body: 'Compress long PDFs, DOCX, and PPTX files into organized lessons with clear headings and summaries.',
    src: 'https://placehold.co/420x540/e8f5ff/12324a.svg?text=Study+Guides',
    alt: 'Study guide placeholder',
  },
  {
    id: 2,
    title: 'Flashcards and Quizzes',
    body: 'Practice with generated flashcards and quiz questions so review feels active instead of overwhelming.',
    src: 'https://placehold.co/420x540/f6edff/2b1845.svg?text=Cards+%2B+Quizzes',
    alt: 'Flashcards and quizzes placeholder',
  },
  {
    id: 3,
    title: 'Comfort Controls',
    body: 'Use dark mode, larger study text, stronger contrast, and narrator support for easier reading.',
    src: 'https://placehold.co/420x540/fff2df/3d2814.svg?text=Accessible+Tools',
    alt: 'Accessibility tools placeholder',
  },
];

function FeatureCard({ feature, index }) {
  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.06 }}
    >
      <div className={styles.cardImage}>
        <div className={styles.skeleton} aria-hidden="true" />
        <img
          src={feature.src}
          alt={feature.alt}
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
      <h3 className={styles.cardTitle}>{feature.title}</h3>
      <p className={styles.cardBody}>{feature.body}</p>
    </motion.article>
  );
}

export default function FeaturesSection() {
  return (
    <section aria-labelledby="features-heading" className={styles.section}>
      <div className={styles.inner}>
        <h2 id="features-heading" className={styles.sectionTitle}>
          Built around how students actually study
        </h2>
        <p className={styles.sectionSub}>
          Verso keeps the wireframe simple on purpose: fewer distractions,
          stronger contrast, bigger readable text, and study tools that reduce
          the load of long academic files.
        </p>

        <div className={styles.grid}>
          {FEATURES.map((f, index) => (
            <FeatureCard key={f.id} feature={f} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
