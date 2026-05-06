export const PASSWORD_REQUIREMENTS = [
  { key: 'length', test: (value) => value.length >= 12 },
  { key: 'upper', test: (value) => /[A-Z]/.test(value) },
  { key: 'lower', test: (value) => /[a-z]/.test(value) },
  { key: 'number', test: (value) => /[0-9]/.test(value) },
  { key: 'special', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export const MIN_PASSWORD_LENGTH = 8;
export const MIN_PASSWORD_SCORE = 4;

export function getPasswordScore(password = '') {
  return PASSWORD_REQUIREMENTS.filter((rule) => rule.test(password)).length;
}

export function isStrongPassword(password = '') {
  return password.length >= MIN_PASSWORD_LENGTH && getPasswordScore(password) >= MIN_PASSWORD_SCORE;
}
