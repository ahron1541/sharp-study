import styles from './PillButton.module.css';

/**
 * Pill-shaped button for auth forms.
 *
 * Props:
 *   variant  — 'primary' | 'secondary' | 'accent'  (default: 'primary')
 *   loading  — shows spinner
 *   type     — 'button' | 'submit'  (default: 'button')
 *   disabled
 *   onClick
 *   className — additional CSS module class for width overrides etc.
 */
export default function PillButton({
  children,
  variant = 'primary',
  loading = false,
  type = 'button',
  disabled = false,
  onClick,
  ariaLabel,
  className = '',
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={[
        styles.btn,
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <span className={styles.spinner} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}