const ALLOWED_USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const USERNAME_SYMBOL_PATTERN = /[._-]/;

const USERNAME_RULE_MESSAGE =
  'Username must be 6-20 characters, include at least 3 letters, and use only letters, numbers, or occasional dots, underscores, or hyphens.';

function normalizeUsername(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getUsernameValidationError(value = '') {
  const username = normalizeUsername(value);

  if (username.length < 6 || username.length > 20) {
    return 'Username must be 6-20 characters long.';
  }

  if (!ALLOWED_USERNAME_PATTERN.test(username)) {
    return 'Username can only contain letters, numbers, dots, underscores, or hyphens.';
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

function isValidUsername(value = '') {
  return !getUsernameValidationError(value);
}

module.exports = {
  USERNAME_RULE_MESSAGE,
  normalizeUsername,
  getUsernameValidationError,
  isValidUsername,
};
