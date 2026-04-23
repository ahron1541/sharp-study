import DOMPurify from 'dompurify';

// Use when rendering HTML content (AI study guides)
export const sanitizeHtml = (dirty) => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'p',
                   'h1', 'h2', 'h3', 'h4', 'br', 'span', 'mark', 'code'],
    ALLOWED_ATTR: ['class'],
  });
};

// Use for plain text — strips ALL HTML
export const sanitizePlainText = (input) => {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
};