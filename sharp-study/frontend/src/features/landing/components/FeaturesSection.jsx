import { motion } from 'framer-motion';
import styles from './FeaturesSection.module.css';

const FEATURES = [
  {
    id: 1,
    title: 'Study Guides',
    body: 'When a lesson feels too long or crowded, Verso breaks the main ideas into readable sections, summaries, and headings you can follow.',
    src: 'https://cdn.undraw.co/illustration/reading-notes_dg9z.svg',
    alt: 'Student reading organized study notes',
  },
  {
    id: 2,
    title: 'Flashcards',
    body: 'When facts are hard to remember, generated cards help you review one idea at a time and build recall without rereading everything.',
    src: 'https://cdn.undraw.co/illustrations/choose-card_es1o.svg',
    alt: 'Person choosing study cards',
  },
  {
    id: 3,
    title: 'Quizzes',
    body: 'When tests feel uncertain, practice questions help you check what you know and spot topics that still need attention.',
    src: 'https://cdn.undraw.co/illustrations/quiz_zvhe.svg',
    alt: 'Student answering quiz questions',
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
          Long readings, memory-heavy topics, and quiz prep can be hard to
          manage. Verso turns those moments into smaller study actions with
          accessible reading and voice support nearby.
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
