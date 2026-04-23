import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Step1EmailOTP from './Step1EmailOTP';
import Step2UserDetails from './Step2UserDetails';
import Step3Success from './Step3Success';
import AuthTabs from '../../shared/components/AuthTabs';
import styles from './SignupStepper.module.css';

const TOTAL = 3;

const slideVariants = {
  enter:  (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center:           ({ x: 0, opacity: 1 }),
  exit:   (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

function StepCircle({ step, current }) {
  const complete = step < current;
  const active   = step === current;
  return (
    <div
      className={`${styles.circle} ${complete ? styles.complete : ''} ${active ? styles.active : ''}`}
      aria-current={active ? 'step' : undefined}
    >
      {complete ? '✓' : step}
    </div>
  );
}

export default function SignupStepper() {
  const [step,          setStep]          = useState(1);
  const [direction,     setDirection]     = useState(1);
  const [verifiedEmail, setVerifiedEmail] = useState('');

  const goTo = (next) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const steps = [
    <Step1EmailOTP
      key="step1"
      onVerified={(email) => { setVerifiedEmail(email); goTo(2); }}
    />,
    <Step2UserDetails
      key="step2"
      email={verifiedEmail}
      onSuccess={() => goTo(3)}
    />,
    <Step3Success key="step3" />,
  ];

  return (
    <div className={styles.wrapper}>
      {/* Auth Tabs */}
      <AuthTabs activeTab="signup" />

      {/* Step indicator */}
      <nav
        aria-label={`Step ${step} of ${TOTAL}`}
        className={styles.indicator}
      >
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} className={styles.stepGroup}>
            <StepCircle step={i + 1} current={step} />
            {i < TOTAL - 1 && (
              <div className={`${styles.connector} ${step > i + 1 ? styles.filled : ''}`} />
            )}
          </div>
        ))}
      </nav>

      {/* Slide animation */}
      <div className={styles.content}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            {steps[step - 1]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}