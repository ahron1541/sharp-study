import { isStrongPassword } from '../../features/auth/shared/utils/passwordPolicy';

export const validators = {
  email: (value) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return 'Email is required.';
    if (!pattern.test(value)) return 'Please enter a valid email address.';
    return null;
  },

  password: (value) => {
    if (!value) return 'Password is required.';
    if (!isStrongPassword(value)) return 'Use at least 8 characters and pass 4 of the 5 strength checks.';
    return null;
  },

  required: (label) => (value) => {
    if (!value || !value.toString().trim()) return `${label} is required.`;
    return null;
  },

  fileType: (allowed) => (file) => {
    if (!file) return 'Please select a file.';
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) return `Only ${allowed.join(', ')} files are allowed.`;
    return null;
  },

  fileSize: (maxMB) => (file) => {
    if (!file) return null;
    const maxBytes = maxMB * 1024 * 1024;
    if (file.size > maxBytes) return `File must be smaller than ${maxMB}MB.`;
    return null;
  },
};
