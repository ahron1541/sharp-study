const sanitizeHtml = require('sanitize-html');

const STUDY_GUIDE_META_PATTERN = /^\s*<!--SHARP_STUDY_META:([\s\S]*?)-->\s*/i;

const allowedTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'details',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

const allowedAttributes = {
  a: ['href', 'rel', 'target'],
  code: ['class'],
  mark: ['data-highlight-color'],
  pre: ['class'],
  table: ['class'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

const allowedClasses = {
  code: [/^language-[a-z0-9-]+$/],
  pre: ['study-guide-code-block'],
  table: ['study-guide-table'],
};

function sanitizeHtmlFragment(html = '') {
  return sanitizeHtml(String(html || ''), {
    allowedTags,
    allowedAttributes,
    allowedClasses,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }, true),
    },
  }).trim();
}

function sanitizePlainText(value = '') {
  return sanitizeHtml(String(value || ''), {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  }).replace(/\s+/g, ' ').trim();
}

function sanitizeMetadataValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(sanitizeMetadataValue)
      .filter((entry) => entry !== null && entry !== undefined && entry !== '');
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [sanitizePlainText(key), sanitizeMetadataValue(entry)])
        .filter(([key, entry]) => key && entry !== null && entry !== undefined && entry !== '')
    );
  }

  if (typeof value === 'string') {
    return sanitizePlainText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return null;
}

function parseMetadata(rawMetadata = '') {
  try {
    const parsed = JSON.parse(rawMetadata);
    return sanitizeMetadataValue(parsed) || {};
  } catch {
    return {};
  }
}

function serializeMetadata(metadata) {
  return JSON.stringify(sanitizeMetadataValue(metadata) || {}).replace(/--/g, '- -');
}

function sanitizeStudyGuideContent(rawContent = '') {
  const raw = String(rawContent || '');
  const match = raw.match(STUDY_GUIDE_META_PATTERN);
  const metadata = match ? parseMetadata(match[1]) : null;
  const html = match ? raw.replace(STUDY_GUIDE_META_PATTERN, '') : raw;
  const cleanHtml = sanitizeHtmlFragment(html);

  if (!metadata) {
    return cleanHtml;
  }

  return `<!--SHARP_STUDY_META:${serializeMetadata(metadata)}-->\n${cleanHtml}`.trim();
}

module.exports = {
  sanitizeHtmlFragment,
  sanitizePlainText,
  sanitizeStudyGuideContent,
};
