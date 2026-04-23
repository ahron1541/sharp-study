export const validators = {
  email: (value) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return 'Email is required.';
    if (!pattern.test(value)) return 'Please enter a valid email address.';
    return null;
  },

  password: (value) => {
    if (!value) return 'Password is required.';
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(value)) return 'Must include an uppercase letter.';
    if (!/[0-9]/.test(value)) return 'Must include a number.';
    if (!/[^A-Za-z0-9]/.test(value)) return 'Must include a special character (!@#$...).';
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