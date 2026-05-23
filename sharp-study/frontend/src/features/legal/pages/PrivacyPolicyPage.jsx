import { Link } from 'react-router-dom';
import LandingNav from '../../landing/components/LandingNav';
import LandingFooter from '../../landing/components/LandingFooter';
import styles from './LegalPage.module.css';

const UPDATED = 'May 24, 2026';

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <LandingNav />
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Verso privacy notice</p>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.intro}>
            This policy explains what Verso needs to run your account and study tools,
            how that information is used, and the choices you have while using the platform.
          </p>
          <p className={styles.updated}>Last updated: {UPDATED}</p>
        </section>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>Information Verso Uses</h2>
            <ul>
              <li>Account details such as your email address, username, name, password hash, role, and preference settings.</li>
              <li>Study materials you upload or create, including document text, study guides, flashcards, quizzes, and progress records.</li>
              <li>Security and service records such as login attempts, verification codes, audit logs, timestamps, and basic request information.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>How The Information Is Used</h2>
            <p>
              Verso uses account information to let you sign up, log in, recover your account,
              save your study materials, apply accessibility preferences, and protect the service
              from abuse. Study content is used to create and display the learning tools you request.
            </p>
          </section>

          <section className={styles.section}>
            <h2>AI And Study Content</h2>
            <p>
              When you ask Verso to generate a study guide, flashcards, quizzes, or narrator-ready
              content, parts of your learning material may be processed by configured AI services.
              Do not upload material you are not allowed to use or material that includes private
              information you do not want processed for study features.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Sharing</h2>
            <p>
              Verso does not sell your personal information. Information may be shared with service
              providers that help run the platform, such as hosting, authentication, email delivery,
              storage, security, and AI generation providers. Access is limited to what is needed
              for the service to work.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Security And Retention</h2>
            <p>
              Verso is designed to use account authentication, validation, rate limits, password hashing,
              and restricted database access patterns. No online service can promise perfect security,
              so use a strong password and keep your login details private.
            </p>
            <p>
              Account, study, and security records are kept while they are needed to provide the service,
              support safety checks, or meet operational needs. You can remove study materials from the app
              where deletion controls are available.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Your Choices</h2>
            <ul>
              <li>You can update supported profile and accessibility settings in the app.</li>
              <li>You can archive or delete supported learning materials from your workspace.</li>
              <li>You can ask for help with account access or data questions through the support channel provided by Verso.</li>
            </ul>
          </section>
        </div>

        <div className={styles.linkRow}>
          <Link to="/terms" className={`${styles.link} ${styles.linkPrimary}`}>Read Terms of Service</Link>
          <Link to="/" className={styles.link}>Back to landing page</Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
