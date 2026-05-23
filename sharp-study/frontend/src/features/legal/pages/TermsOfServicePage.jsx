import { Link } from 'react-router-dom';
import LandingNav from '../../landing/components/LandingNav';
import LandingFooter from '../../landing/components/LandingFooter';
import styles from './LegalPage.module.css';

const UPDATED = 'May 24, 2026';

export default function TermsOfServicePage() {
  return (
    <div className={styles.page}>
      <LandingNav />
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Verso user terms</p>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.intro}>
            These terms describe the basic rules for using Verso. They are written to keep the
            platform clear, respectful, and useful for students and administrators.
          </p>
          <p className={styles.updated}>Last updated: {UPDATED}</p>
        </section>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>Using Verso</h2>
            <p>
              Verso helps students turn learning materials into study guides, flashcards, quizzes,
              and accessible review tools. You agree to use the platform for lawful study,
              teaching, accessibility, or school-related purposes.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Your Account</h2>
            <ul>
              <li>Use accurate account information and keep your password private.</li>
              <li>Do not share your account or try to access someone else&apos;s account.</li>
              <li>Administrators may manage accounts and content when needed for safety, support, or school operations.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Your Study Materials</h2>
            <p>
              You remain responsible for the materials you upload or create. Only upload content
              you have permission to use. By uploading content, you allow Verso to process it so
              the app can provide the study features you request.
            </p>
          </section>

          <section className={styles.section}>
            <h2>AI Output</h2>
            <p>
              AI-generated study content can help with review, but it may be incomplete or incorrect.
              Check important answers against your class materials, teacher instructions, and trusted
              sources before relying on them.
            </p>
          </section>

          <section className={styles.section}>
            <h2>What Is Not Allowed</h2>
            <ul>
              <li>Uploading malware, harmful code, or content meant to attack the service.</li>
              <li>Trying to bypass authentication, rate limits, access controls, or account restrictions.</li>
              <li>Using Verso to harass others, violate privacy, or upload content you are not allowed to use.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Service Changes And Availability</h2>
            <p>
              Verso may change features, limits, or workflows as the platform improves. The service
              may also be unavailable during maintenance, provider outages, or unexpected issues.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Account Actions</h2>
            <p>
              Accounts or content may be limited, blocked, or removed when needed to protect users,
              the platform, or the integrity of the learning environment.
            </p>
          </section>
        </div>

        <div className={styles.linkRow}>
          <Link to="/privacy" className={`${styles.link} ${styles.linkPrimary}`}>Read Privacy Policy</Link>
          <Link to="/" className={styles.link}>Back to landing page</Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
