import { useRef, useEffect, useCallback } from 'react';
import styles from './OTPInput.module.css';

const LENGTH = 6;

export default function OTPInput({ value = '', onChange, disabled = false, error = false }) {
  const refs = useRef([]);

  // Derive array from string
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  const updateValue = useCallback(
    (newDigits) => onChange(newDigits.join('')),
    [onChange]
  );

  const handleChange = (index, e) => {
    const char = e.target.value.slice(-1);
    if (!/^\d$/.test(char) && char !== '') return;

    const next = [...digits];
    next[index] = char;
    updateValue(next);

    // Pop animation
    refs.current[index]?.classList.add(styles.popping);
    setTimeout(() => refs.current[index]?.classList.remove(styles.popping), 120);

    // Auto-advance
    if (char && index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]; next[index] = '';
        updateValue(next);
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft'  && index > 0)          refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    const next = Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? '');
    updateValue(next);
    const focusIndex = Math.min(pasted.length, LENGTH - 1);
    refs.current[focusIndex]?.focus();
  };

  // Auto-focus first empty box on mount
  useEffect(() => {
    const first = digits.findIndex((d) => !d);
    refs.current[first !== -1 ? first : 0]?.focus();
  }, []); // eslint-disable-line

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      className={styles.group}
      onPaste={handlePaste}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          aria-invalid={error}
          className={[
            styles.box,
            digit  ? styles.filled : '',
            error  ? styles.error  : '',
          ].join(' ')}
        />
      ))}
    </div>
  );
}