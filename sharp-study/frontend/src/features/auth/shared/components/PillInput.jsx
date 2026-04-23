import { forwardRef } from 'react';
import { MdWarning } from 'react-icons/md';
import styles from './PillInput.module.css';

/**
 * Pill-shaped input component matching wireframe design.
 *
 * Props:
 *   id, label, type, value, onChange, placeholder
 *   error        — error message string
 *   required     — shows asterisk on label
 *   disabled     — greyed-out locked state (for displaying username in recovery)
 *   leftIcon     — React element for the left icon slot
 *   rightIcon    — React element for the right icon slot
 *   rightAddon   — { label, onClick, disabled } for inline text button (e.g. "Send")
 *   toggleButton — { label, onClick, icon } for show/hide password
 *   autoComplete
 *   inputMode
 *   describedBy
 */
const PillInput = forwardRef(function PillInput(
  {
    id,
    label,
    type = 'text',
    value,
    onChange,
    onKeyDown,
    placeholder,
    error,
    required = false,
    disabled = false,
    leftIcon,
    rightIcon,
    rightAddon,
    toggleButton,
    autoComplete,
    inputMode,
    describedBy,
    'aria-invalid': ariaInvalid,
  },
  ref
) {
  const hasLeftIcon  = Boolean(leftIcon);
  const hasRightAddon = Boolean(rightAddon);
  const hasRightIcon  = Boolean(rightIcon || toggleButton);

  const describedByIds = [
    error       ? `${id}-error` : null,
    describedBy || null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={styles.wrapper}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className={styles.inputRow}>
        {/* Left icon */}
        {hasLeftIcon && (
          <span className={styles.leftIcon} aria-hidden="true">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-required={required}
          aria-invalid={ariaInvalid ?? (!!error)}
          aria-describedby={describedByIds}
          className={[
            styles.input,
            hasLeftIcon   ? styles.hasLeftIcon  : '',
            hasRightAddon ? styles.hasRightAddon : '',
            hasRightIcon  ? styles.hasRightIcon  : '',
            error    ? styles.error    : '',
            disabled ? styles.disabled : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {/* Right: inline text button (e.g. "Send") */}
        {rightAddon && (
          <button
            type="button"
            onClick={rightAddon.onClick}
            disabled={rightAddon.disabled}
            aria-label={rightAddon.ariaLabel || rightAddon.label}
            className={styles.rightAddon}
          >
            {rightAddon.label}
          </button>
        )}

        {/* Right: toggle button (show/hide password) */}
        {toggleButton && (
          <button
            type="button"
            onClick={toggleButton.onClick}
            aria-label={toggleButton.label}
            aria-pressed={toggleButton.pressed}
            className={styles.toggleButton}
          >
            <span aria-hidden="true">{toggleButton.icon}</span>
          </button>
        )}

        {/* Right: static icon */}
        {rightIcon && !toggleButton && (
          <span className={styles.rightIcon} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <span id={`${id}-error`} role="alert" className={styles.errorMsg}>
          <MdWarning size={13} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
});

export default PillInput;