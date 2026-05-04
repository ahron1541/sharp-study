const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

const QUICK_REFERENCE_GROUPS = [
  { id: 'key-terms', label: 'Key Terms/Concepts', pattern: /term|concept|definition|vocabulary|glossary/i },
  { id: 'key-people', label: 'Key People', pattern: /people|person|figure|character|leader|hero/i },
  { id: 'key-dates', label: 'Key Dates', pattern: /date|timeline|chronology|history|year/i },
  { id: 'key-events', label: 'Key Events', pattern: /event|events|process|steps|sequence/i },
  { id: 'cause-effect', label: 'Cause and Effect', pattern: /cause|effect|reason|result|impact/i },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseInlineMarkdown(text) {
  const escaped = escapeHtml(text);

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function markdownToHtml(markdown) {
  const preprocessed = String(markdown)
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])(#{1,6}\s+)/g, '$1\n$2')
    .replace(/([^\n])(\d+\.\s+[A-Za-z])/g, '$1\n$2')
    .replace(/([^\n])([*-]\s+[A-Za-z])/g, '$1\n$2')
    .replace(/([^\n])(>\s+[A-Za-z])/g, '$1\n$2');

  const lines = preprocessed
    .split('\n');

  const blocks = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quoteLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${parseInlineMarkdown(paragraph.join(' ').trim())}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    blocks.push(`<${tag}>${listItems.map((item) => `<li>${parseInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
    listType = null;
    listItems = [];
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push(`<blockquote>${quoteLines.map((line) => `<p>${parseInlineMarkdown(line)}</p>`).join('')}</blockquote>`);
    quoteLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = Math.min(6, headingMatch[1].length);
      blocks.push(`<h${level}>${parseInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push('<hr />');
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(orderedMatch[1]);
      continue;
    }

    if (line.startsWith('>')) {
      flushParagraph();
      flushList();
      quoteLines.push(line.replace(/^>\s?/, ''));
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushQuote();

  return blocks.join('\n');
}

function looksLikeHtml(content) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

export function normalizeStudyGuideHtml(rawContent) {
  if (!rawContent) return '';

  const content = String(rawContent).trim();
  if (!content) return '';

  return looksLikeHtml(content) ? content : markdownToHtml(content);
}

export function stripStudyGuideHtml(html) {
  const cleaned = normalizeStudyGuideHtml(html);
  const doc = new DOMParser().parseFromString(cleaned, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

export function extractStudyGuideSections(rawContent) {
  const html = normalizeStudyGuideHtml(rawContent);
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(doc.body.children);
  const sections = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const textDoc = new DOMParser().parseFromString(`<div>${current.html}</div>`, 'text/html');
    const text = textDoc.body.textContent?.replace(/\s+/g, ' ').trim() || '';
    const snippets = Array.from(textDoc.querySelectorAll('li, p'))
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 4);

    sections.push({
      id: current.id,
      title: current.title,
      level: current.level,
      html: current.html,
      text,
      summary: summarizeText(text, 180),
      snippets,
    });
  };

  nodes.forEach((node, index) => {
    if (HEADING_TAGS.has(node.tagName)) {
      pushCurrent();
      current = {
        id: `section-${sections.length}-${index}`,
        title: node.textContent?.trim() || `Section ${sections.length + 1}`,
        level: Number(node.tagName.slice(1)),
        html: node.outerHTML,
      };
      return;
    }

    if (!current) {
      current = {
        id: `section-${sections.length}-${index}`,
        title: 'Overview',
        level: 2,
        html: '',
      };
    }

    current.html += node.outerHTML;
  });

  pushCurrent();

  return sections.length ? sections : [{
    id: 'section-0',
    title: 'Overview',
    level: 2,
    html: html,
    text: stripStudyGuideHtml(html),
    summary: summarizeText(stripStudyGuideHtml(html), 180),
    snippets: [],
  }];
}

export function summarizeText(text, limit = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= limit) return clean;

  const sentence = clean.match(/^(.+?[.!?])(\s|$)/);
  if (sentence && sentence[1].length <= limit) {
    return sentence[1];
  }

  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

function inferTopic(sections, fallbackTitle) {
  const firstHeading = sections.find((section) => section.title && section.title !== 'Overview');
  if (firstHeading) return firstHeading.title;
  return fallbackTitle || 'the topic';
}

export function buildQuickReferenceGroups(sections, fallbackTitle = 'Study Guide') {
  const groups = QUICK_REFERENCE_GROUPS.map((group) => {
    const items = sections
      .filter((section) => group.pattern.test(section.title))
      .map((section) => ({
        id: section.id,
        title: section.title,
        detail: section.summary || section.snippets[0] || summarizeText(section.text, 120),
      }));

    return items.length ? { ...group, items } : null;
  }).filter(Boolean);

  if (groups.length) return groups;

  const fallbackItems = sections.slice(0, 4).map((section) => ({
    id: section.id,
    title: section.title,
    detail: section.summary || section.snippets[0] || summarizeText(section.text, 120),
  }));

  return [{
    id: 'quick-recall',
    label: `${fallbackTitle} Recall`,
    items: fallbackItems,
  }];
}

export function buildDiscussionQuestions(sections, fallbackTitle = 'this lesson') {
  const questionSection = sections.find((section) => /discussion questions|self[- ]?check|reflection|review questions?/i.test(section.title));

  if (questionSection) {
    const questionMatches = questionSection.snippets
      .filter((item) => /\?/.test(item) || /^[A-Z]/.test(item))
      .map((item) => item.replace(/\s+/g, ' ').trim());

    if (questionMatches.length) {
      return questionMatches.slice(0, 6).map((question, index) => ({
        id: `dq-${index}`,
        question,
        answer: `Revisit the related section and explain the idea in your own words.`,
      }));
    }
  }

  const topic = inferTopic(sections, fallbackTitle);
  const focusSections = sections.filter((section) => section.title !== 'Overview').slice(0, 4);
  const summary = focusSections[0]?.summary || 'the main ideas from the guide';

  return [
    {
      id: 'dq-1',
      question: `How would you explain ${topic} in one minute to a classmate?`,
      answer: `Focus on the most important idea, then add one supporting detail from ${summary}.`,
    },
    {
      id: 'dq-2',
      question: `Which part of the lesson feels most important for remembering later?`,
      answer: `Pick the section that has the strongest definitions, dates, or examples.`,
    },
    {
      id: 'dq-3',
      question: `What real-world example makes ${topic} easier to understand?`,
      answer: `Use a school, community, or daily-life example that matches the lesson.`,
    },
    {
      id: 'dq-4',
      question: `What is one question you would still ask after reading this guide?`,
      answer: `Turn a confusing point into a study question and review that section again.`,
    },
    {
      id: 'dq-5',
      question: `How does this guide connect the main ideas across its sections?`,
      answer: `Look for links between the overview, key details, and the final takeaways.`,
    },
    {
      id: 'dq-6',
      question: `Which details would you put into a quick review sheet before a quiz?`,
      answer: `Choose short definitions, major names, important dates, and any repeated ideas.`,
    },
  ];
}

export function createInstructionalStudyGuideTemplate() {
  return `
<h1>Untitled Study Guide</h1>
<p>Use this space to build a clean, fast study guide.</p>
<h2>Overview</h2>
<p>Write the main topic in one short paragraph.</p>
<h2>Key Concepts</h2>
<ul>
  <li><strong>Term:</strong> add a short definition.</li>
  <li><strong>Term:</strong> add one important detail.</li>
</ul>
<h2>Examples</h2>
<ul>
  <li>Use a real example that makes the lesson easier to remember.</li>
</ul>
<h2>Quick Review</h2>
<ol>
  <li>What is the main idea?</li>
  <li>Which details matter most?</li>
  <li>What should you remember for later?</li>
</ol>
<h2>Discussion Questions</h2>
<ol>
  <li>How would you explain this topic to someone new?</li>
  <li>What part of the lesson feels most important?</li>
  <li>What question would you ask in class?</li>
</ol>
<p><mark>Tip:</mark> Use headings for sections, bullets for facts, and bold for important terms.</p>
`.trim();
}
