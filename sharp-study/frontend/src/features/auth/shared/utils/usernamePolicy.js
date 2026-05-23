export const USERNAME_RULES_TEXT =
  'Use 6-20 characters, at least 3 letters, and only letters, numbers, or occasional dots, underscores, or hyphens.';

const ALLOWED_USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const USERNAME_SYMBOL_PATTERN = /[._-]/;

export function normalizeUsername(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function getUsernameValidationError(value = '') {
  const username = normalizeUsername(value);

  if (username.length < 6 || username.length > 20) {
    return 'Username must be 6-20 characters long.';
  }

  if (!ALLOWED_USERNAME_PATTERN.test(username)) {
    return 'Use only letters, numbers, dots, underscores, or hyphens.';
  }

  const letterCount = (username.match(/[a-z]/g) || []).length;
  if (letterCount < 3) {
    return 'Username must include at least 3 letters.';
  }

  if (USERNAME_SYMBOL_PATTERN.test(username[0]) || USERNAME_SYMBOL_PATTERN.test(username.at(-1))) {
    return 'Dots, underscores, and hyphens cannot be first or last.';
  }

  if (/[._-]{2,}/.test(username)) {
    return 'Use only one dot, underscore, or hyphen at a time.';
  }

  return null;
}

export function isValidUsername(value = '') {
  return !getUsernameValidationError(value);
}
