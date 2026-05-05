const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

const QUICK_REFERENCE_GROUPS = [
  { id: 'key-terms', label: 'Key Terms and Concepts', pattern: /term|concept|definition|vocabulary|glossary|idea/i },
  { id: 'key-people', label: 'Key People', pattern: /people|person|figure|character|leader|hero|scientist|author/i },
  { id: 'key-dates', label: 'Key Dates and Timeline', pattern: /date|timeline|chronology|history|year|period|era/i },
  { id: 'key-events', label: 'Processes and Events', pattern: /event|events|process|steps|sequence|cycle|stages/i },
  { id: 'cause-effect', label: 'Cause and Effect', pattern: /cause|effect|reason|result|impact|outcome/i },
  { id: 'formulas', label: 'Formulas and Methods', pattern: /formula|equation|method|procedure|strategy|solve|calculation/i },
  { id: 'comparisons', label: 'Comparisons', pattern: /compare|contrast|difference|similar|versus/i },
  { id: 'examples', label: 'Examples and Applications', pattern: /example|application|case|scenario|practice/i },
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'can', 'for', 'from', 'has', 'have', 'how',
  'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'there', 'these', 'this',
  'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'your', 'you', 'than', 'then',
  'they', 'them', 'will', 'would', 'about', 'after', 'before', 'during', 'over', 'under', 'between',
]);

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

function extractKeywords(sourceText = '', limit = 6) {
  const counts = new Map();
  const words = String(sourceText)
    .toLowerCase()
    .match(/[a-z][a-z-]{2,}/g) || [];

  words.forEach((word) => {
    if (STOP_WORDS.has(word)) return;
    counts.set(word, (counts.get(word) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function inferDynamicReferenceLabel(sections, fallbackTitle) {
  const titles = sections
    .map((section) => section.title)
    .filter(Boolean)
    .filter((title) => title !== 'Overview');

  if (titles.some((title) => /formula|equation|solve|calculate/i.test(title))) {
    return 'Formulas and Steps';
  }
  if (titles.some((title) => /timeline|year|history|era|date/i.test(title))) {
    return 'Timeline and Key Details';
  }
  if (titles.some((title) => /compare|contrast|difference/i.test(title))) {
    return 'Comparisons';
  }
  if (titles.some((title) => /example|application|case/i.test(title))) {
    return 'Examples and Applications';
  }

  return `${fallbackTitle} Key Points`;
}

function inferReferenceFormat(section) {
  if (/process|steps|sequence|timeline|chronology|procedure|method|stages/i.test(section.title || '')) {
    return 'ordered';
  }
  return 'unordered';
}

function extractReferenceEntries(section) {
  const doc = new DOMParser().parseFromString(`<div>${section.html || ''}</div>`, 'text/html');
  const orderedItems = Array.from(doc.querySelectorAll('ol > li'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (orderedItems.length) {
    return {
      format: 'ordered',
      entries: orderedItems.slice(0, 6),
    };
  }

  const unorderedItems = Array.from(doc.querySelectorAll('ul > li'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (unorderedItems.length) {
    return {
      format: 'unordered',
      entries: unorderedItems.slice(0, 6),
    };
  }

  const snippetEntries = (section.snippets || [])
    .map((item) => item?.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    format: inferReferenceFormat(section),
    entries: snippetEntries.length ? snippetEntries : [section.summary || summarizeText(section.text, 120)].filter(Boolean),
  };
}

function sentenceSplit(sourceText = '') {
  return String(sourceText)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);
}

function titleKeywords(title = '') {
  return String(title)
    .toLowerCase()
    .match(/[a-z][a-z-]{2,}/g)?.filter((word) => !STOP_WORDS.has(word)) || [];
}

function inferEntriesFromSource(section, sourceText = '') {
  const keywords = titleKeywords(section.title);
  const sentences = sentenceSplit(sourceText);

  if (!sentences.length) return [];

  const ranked = sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const score = keywords.reduce((sum, keyword) => sum + (lower.includes(keyword) ? 1 : 0), 0);
      return { sentence, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length)
    .slice(0, 4)
    .map((item) => item.sentence);

  return ranked;
}

function buildFallbackSectionTitle(section, sourceText = '') {
  const keywords = titleKeywords(section.title);
  const supporting = inferEntriesFromSource(section, sourceText)[0];
  if (supporting) {
    const shorter = supporting.length > 68 ? `${supporting.slice(0, 67).trimEnd()}…` : supporting;
    return shorter;
  }

  if (keywords.length) {
    return `Review how ${keywords.slice(0, 2).join(' and ')} appear in the lesson.`;
  }

  return '';
}

export function buildQuickReferenceGroups(sections, sourceText = '', fallbackTitle = 'Study Guide') {
  const groups = QUICK_REFERENCE_GROUPS.map((group) => {
    const items = sections
      .filter((section) => group.pattern.test(section.title))
      .map((section) => {
        const structured = extractReferenceEntries(section);
        const inferredEntries = structured.entries.filter(Boolean).length >= 2
          ? structured.entries
          : inferEntriesFromSource(section, sourceText);
        const finalEntries = (structured.entries.filter(Boolean).length ? structured.entries : inferredEntries)
          .filter((entry) => entry && entry !== section.title)
          .slice(0, 6);

        return {
          id: section.id,
          title: section.title,
          detail:
            section.summary ||
            section.snippets[0] ||
            finalEntries[0] ||
            summarizeText(section.text, 120) ||
            buildFallbackSectionTitle(section, sourceText),
          format: structured.format,
          entries: finalEntries,
        };
      });

    return items.length ? { ...group, items: items.filter((item) => item.detail || item.entries.length) } : null;
  }).filter(Boolean);

  if (groups.length) return groups;

  const keywords = extractKeywords(sourceText, 4);
  const fallbackItems = sections.slice(0, 4).map((section, index) => {
    const structured = extractReferenceEntries(section);
    const inferredEntries = inferEntriesFromSource(section, sourceText);
    const finalEntries = (structured.entries.filter(Boolean).length ? structured.entries : inferredEntries)
      .filter((entry) => entry && entry !== section.title)
      .slice(0, 6);

    return {
      id: section.id,
      title: section.title,
      detail:
        section.summary ||
        section.snippets[0] ||
        finalEntries[0] ||
        summarizeText(section.text, 120) ||
        (keywords[index] ? `Review how ${keywords[index]} fits into this lesson.` : '') ||
        buildFallbackSectionTitle(section, sourceText),
      format: structured.format,
      entries: finalEntries,
    };
  });

  return [{
    id: 'lesson-reference',
    label: inferDynamicReferenceLabel(sections, fallbackTitle),
    items: fallbackItems,
  }];
}

export function buildDiscussionQuestions(sections, sourceText = '', fallbackTitle = 'this lesson') {
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
  const keywords = extractKeywords(sourceText, 3);
  const keywordPhrase = keywords.length ? keywords.join(', ') : topic;
  const firstSection = focusSections[0]?.title || topic;
  const secondSection = focusSections[1]?.title || 'the next main section';

  return [
    {
      id: 'dq-1',
      question: `How would you explain ${topic} to a classmate using ideas from ${firstSection}?`,
      answer: `Start with the main idea, then connect it to one concrete detail from ${summary}.`,
    },
    {
      id: 'dq-2',
      question: `Which lesson details about ${keywordPhrase} feel most important to remember later?`,
      answer: `Choose the terms, facts, or examples that appear most often and explain why they matter.`,
    },
    {
      id: 'dq-3',
      question: `What example from real life would make ${topic} easier to understand?`,
      answer: `Use a school, community, work, or daily-life situation that matches the lesson.`,
    },
    {
      id: 'dq-4',
      question: `How does ${firstSection} connect with ${secondSection}?`,
      answer: `Look for cause-and-effect, comparison, sequence, or shared vocabulary between both sections.`,
    },
    {
      id: 'dq-5',
      question: `What is one question you would still ask after reading this lesson?`,
      answer: `Turn one confusing point into a short study question, then revisit the heading where it appears.`,
    },
    {
      id: 'dq-6',
      question: `Which details would you place in a quick review sheet before a quiz on ${topic}?`,
      answer: `Keep only the shortest definitions, repeated ideas, and high-value facts from the lesson.`,
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
