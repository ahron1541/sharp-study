import { useState } from 'react';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import PillInput from './PillInput';

/**
 * Password field with show/hide toggle.
 * Delegates all visual rendering to PillInput.
 */
export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete = 'current-password',
  placeholder = '',
  required = true,
  describedBy,
}) {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation('auth');

  return (
    <PillInput
      id={id}
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      error={error}
      describedBy={describedBy}
      toggleButton={{
        onClick: () => setVisible((v) => !v),
        label:   visible ? t('password.hidePassword') : t('password.showPassword'),
        pressed: visible,
        icon:    visible
          ? <AiOutlineEyeInvisible size={20} />
          : <AiOutlineEye          size={20} />,
      }}
    />
  );
}