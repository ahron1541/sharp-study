const { GoogleGenerativeAI } = require('@google/generative-ai');

const REQUEST_TIMEOUT_MS = 45000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-001';

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const providerCooldowns = new Map();

function sleep(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Generation aborted.'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Generation aborted.'));
    };

    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

function isAbortError(error) {
  return error?.name === 'AbortError' || /aborted/i.test(error?.message || '');
}

function isBusyError(error) {
  return error?.status === 429 || error?.status === 500 || error?.status === 503;
}

function isQuotaError(error) {
  return error?.status === 429 || /quota|rate limit|too many requests/i.test(error?.message || '');
}

function isHardQuotaError(error) {
  return /quota exceeded|exceeded your current quota|billing details|free_tier/i.test(error?.message || '');
}

function parseRetryDelayMs(error) {
  const message = String(error?.message || '');
  const match = message.match(/retry in\s+([\d.]+)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round(seconds * 1000);
}

function isProviderCoolingDown(providerName) {
  const cooldownUntil = providerCooldowns.get(providerName);
  return Boolean(cooldownUntil && cooldownUntil > Date.now());
}

function setProviderCooldown(providerName, durationMs) {
  if (!durationMs || durationMs <= 0) return;
  providerCooldowns.set(providerName, Date.now() + durationMs);
}

function stripCodeFences(text = '') {
  return String(text).trim().replace(/```json|```html|```/gi, '').trim();
}

function parseJsonResponse(text) {
  return JSON.parse(stripCodeFences(text));
}

async function withRetry(apiCall, options = {}) {
  const {
    maxRetries = 5,
    initialDelayMs = 2500,
    signal,
    label = 'generation',
    provider = 'provider',
  } = options;

  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await apiCall();
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw error;
      }

      if (isHardQuotaError(error)) {
        throw error;
      }

      if (isBusyError(error) && attempt < maxRetries) {
        const jitter = Math.round(delay * (0.15 + Math.random() * 0.2));
        const waitTime = delay + jitter;
        console.warn(
          `[Attempt ${attempt}/${maxRetries}] ${provider} busy during ${label} (${error.status}). Retrying in ${waitTime}ms...`
        );
        await sleep(waitTime, signal);
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  let bodyJson = null;

  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = null;
  }

  if (!response.ok) {
    const error = new Error(
      bodyJson?.error?.message ||
      bodyJson?.error ||
      bodyJson?.message ||
      bodyText ||
      `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.statusText = response.statusText;
    error.body = bodyJson || bodyText;
    throw error;
  }

  return bodyJson;
}

async function geminiGenerate(prompt, requestOptions = {}) {
  if (!geminiClient) {
    const error = new Error('Gemini API key is not configured.');
    error.status = 500;
    throw error;
  }

  const model = geminiClient.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.55,
      maxOutputTokens: 4096,
    },
  });

  const result = await withRetry(
    () => model.generateContent(prompt, { ...requestOptions, timeout: REQUEST_TIMEOUT_MS }),
    { ...requestOptions, label: 'generation', provider: 'Gemini' }
  );

  return result.response.text();
}

async function groqGenerate(prompt, requestOptions = {}) {
  if (!process.env.GROQ_API_KEY) {
    const error = new Error('Groq API key is not configured.');
    error.status = 500;
    throw error;
  }

  const body = {
    model: GROQ_MODEL,
    temperature: 0.55,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'Follow the user instructions exactly and return only the requested output format.',
      },
      { role: 'user', content: prompt },
    ],
  };

  const data = await withRetry(
    () => fetchJson('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: requestOptions.signal,
    }),
    { ...requestOptions, label: 'generation', provider: 'Groq' }
  );

  return data?.choices?.[0]?.message?.content || '';
}

async function openRouterGenerate(prompt, requestOptions = {}) {
  if (!process.env.OPENROUTER_API_KEY) {
    const error = new Error('OpenRouter API key is not configured.');
    error.status = 500;
    throw error;
  }

  const body = {
    model: OPENROUTER_MODEL,
    temperature: 0.55,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'Follow the user instructions exactly and return only the requested output format.',
      },
      { role: 'user', content: prompt },
    ],
  };

  const data = await withRetry(
    () => fetchJson('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'https://sharp-study.onrender.com',
        'X-Title': 'Sharp Study',
      },
      body: JSON.stringify(body),
      signal: requestOptions.signal,
    }),
    { ...requestOptions, label: 'generation', provider: 'OpenRouter' }
  );

  return data?.choices?.[0]?.message?.content || '';
}

function getProviders() {
  return [
    {
      name: 'Gemini',
      enabled: Boolean(process.env.GEMINI_API_KEY),
      run: geminiGenerate,
    },
    {
      name: 'Groq',
      enabled: Boolean(process.env.GROQ_API_KEY),
      run: groqGenerate,
    },
    {
      name: 'OpenRouter',
      enabled: Boolean(process.env.OPENROUTER_API_KEY),
      run: openRouterGenerate,
    },
  ].filter((provider) => provider.enabled);
}

async function generateWithFallback(prompt, requestOptions = {}, label = 'generation') {
  const providers = getProviders();
  if (!providers.length) {
    throw new Error('No AI providers are configured. Add at least one API key.');
  }

  let lastError = null;

  for (const provider of providers) {
    if (isProviderCoolingDown(provider.name)) {
      console.info(`[AI Provider] Skipping ${provider.name} for ${label} because it is cooling down after a quota hit.`);
      continue;
    }

    try {
      console.info(`[AI Provider] Trying ${provider.name} for ${label}`);
      const content = await provider.run(prompt, requestOptions);
      if (!content || !String(content).trim()) {
        throw new Error(`${provider.name} returned an empty response.`);
      }
      console.info(`[AI Provider] ${provider.name} succeeded for ${label}`);
      return content;
    } catch (error) {
      lastError = error;
      console.warn(`[AI Provider] ${provider.name} failed for ${label}: ${error.message}`);

      if (isAbortError(error) || requestOptions.signal?.aborted) {
        throw error;
      }

      if (isQuotaError(error)) {
        const retryDelayMs = parseRetryDelayMs(error) || 5 * 60 * 1000;
        setProviderCooldown(provider.name, retryDelayMs);
      }

      const hasMoreProviders = providers[providers.length - 1] !== provider;
      if (!hasMoreProviders) {
        throw error;
      }

      if (!isQuotaError(error) && !isBusyError(error)) {
        console.warn(`[AI Provider] Falling through to next provider after non-quota failure from ${provider.name}.`);
      }
    }
  }

  throw lastError || new Error('All AI providers failed.');
}

function buildStudyGuidePrompt(extractedText) {
  return `
You are an accessibility-focused study coach for students with ADHD and Dyslexia.
Turn the lesson text into a clean, fast study guide that feels easy to review.
The HTML will be rendered directly in a study-guide reader with a heading-based sidebar, so the structure must be accurate and useful for navigation.

Output rules:
- Return semantic HTML only. No markdown, no code fences, no explanations.
- Use only these HTML tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <pre>, <code>, <mark>, <hr>, and <br>.
- Do not include scripts, styles, iframes, forms, images, inline style attributes, JavaScript URLs, or event-handler attributes.
- Use short sentences and simple language.
- Keep the guide focused, skimmable, and genuinely useful for review.
- Use these sections in this order:
  1. <h1>Title</h1>
  2. <h2>Overview</h2>
  3. <h2>Key Concepts</h2>
  4. <h2>Examples</h2>
  5. <h2>Self-Check</h2>
  6. <h2>Discussion Questions</h2>
- Use <h3> only for subheadings under a related <h2> section.
- Every heading must have real content underneath it. Do not create empty headings, placeholder labels, or sections that say nothing.
- Make the heading text specific, meaningful, and easy to jump to from a sidebar.
- Use <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, and <td> when useful.
- Bold the most important terms and names.
- For key points, use a reviewer format such as:
  <li><strong>Important term or point:</strong> normal-text explanation or meaning.</li>
- Keep the keyword or main idea bold, but keep the supporting explanation in normal text.
- Do not include a Quick Reference section in the HTML output. Key references are generated separately.
- Make the main study guide read like a reviewer: clear overview, short explanations, strong organization, and study-friendly wording.
- Cover the major lesson points instead of shrinking the lesson too aggressively.
- If the lesson is long, include more subsection coverage under the existing section headings instead of reducing everything to a tiny summary.
- Include important names, dates, laws, steps, responsibilities, examples, and distinctions when they matter to the lesson.
- Do not leave out key review points just to stay ultra-short.
- In <h2>Discussion Questions</h2>, write 5 to 7 question-and-answer pairs based only on the lesson text.
- Format each pair as:
  <h3>Question text ending in ?</h3>
  <p>Short direct answer grounded in the lesson.</p>
- The answer must answer the question directly. Do not reply with another question, a prompt, or advice like "review the lesson."
- Prefer factual, study-friendly phrasing over filler prose.
- Aim for a rich reviewer, usually around 1100 to 1800 words when the lesson is long enough to support it.

Lesson text:
"""
${extractedText.substring(0, 14000)}
"""
  `;
}

function buildKeyReferencesPrompt(extractedText) {
  return `
Create structured key references for a study guide based only on the lesson text below.
Respond ONLY with a valid JSON array. No markdown, no explanation.

Format:
[
  {
    "label": "Key Terms and Concepts",
    "items": [
      {
        "title": "Important heading",
        "format": "unordered",
        "entries": [
          "<strong>Key point:</strong> normal explanation",
          "<strong>Another point:</strong> normal explanation"
        ]
      }
    ]
  }
]

Rules:
- Create 3 to 5 groups only.
- Use labels such as Key Terms and Concepts, Key People, Key Dates and Timeline, Processes and Events, Cause and Effect, Formulas and Methods, Comparisons, or Examples and Applications only when they fit the lesson.
- Each group should contain 1 to 3 cards only.
- Each card title must be specific to the lesson, not generic filler.
- Each entry must be short, study-friendly, and directly supported by the lesson.
- Make the important word or phrase bold using HTML strong tags, then follow it with a normal explanation.
- Avoid repeating the same facts across different cards.
- Do not include empty groups, placeholders, or advice text.

Lesson text:
"""
${extractedText.substring(0, 10000)}
"""
  `;
}

function buildDiscussionPrompt(extractedText) {
  return `
Create 5 to 6 discussion questions with direct short answers based only on the lesson text below.
Respond ONLY with a valid JSON array. No markdown, no explanation.
Format:
[
  {
    "question": "Question ending with a question mark?",
    "answer": "A short direct answer grounded in the lesson.",
    "support_snippet": "A short exact phrase or sentence copied from the lesson that supports the answer."
  }
]

Rules:
- Every question must clearly come from the lesson content, not from generic studying advice.
- Every answer must directly answer the question.
- Do not repeat the question inside the answer.
- Do not use placeholders like "review the lesson" or "explain in your own words".
- Do not use labels or filler such as "Self-Check", "Think about", "test your understanding", or "important points".
- Do not invent facts that are not supported by the lesson text.
- Keep each answer to 1 to 3 sentences.
- Prefer specific factual answers that include exact names, laws, titles, dates, roles, or examples when the lesson provides them.
- The support_snippet field must be copied closely from the lesson text, not invented or paraphrased.
- If the lesson does not clearly support an answer, do not include that question.

Lesson text:
"""
${extractedText.substring(0, 7000)}
"""
  `;
}

function buildFlashcardsPrompt(extractedText) {
  return `
Create 10 flashcards from the text below.
Respond ONLY with a valid JSON array, no markdown, no explanation.
Format: [{ "front": "Question?", "back": "Short answer" }]

Text:
"""
${extractedText.substring(0, 6000)}
"""
  `;
}

function buildQuizPrompt(extractedText) {
  return `
Create 10 multiple-choice quiz questions from the text.
Respond ONLY with a valid JSON array. No markdown, no explanation.
Format:
[{
  "question": "What is ...?",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_index": 0
}]

Text:
"""
${extractedText.substring(0, 6000)}
"""
  `;
}

async function generateStudyGuide(extractedText, requestOptions = {}) {
  return stripCodeFences(
    await generateWithFallback(buildStudyGuidePrompt(extractedText), requestOptions, 'study guide generation')
  );
}

async function generateKeyReferences(extractedText, requestOptions = {}) {
  const raw = await generateWithFallback(buildKeyReferencesPrompt(extractedText), requestOptions, 'key reference generation');
  return parseJsonResponse(raw);
}

async function generateDiscussionQuestions(extractedText, requestOptions = {}) {
  const raw = await generateWithFallback(buildDiscussionPrompt(extractedText), requestOptions, 'discussion question generation');
  return parseJsonResponse(raw);
}

async function generateFlashcards(extractedText, requestOptions = {}) {
  const raw = await generateWithFallback(buildFlashcardsPrompt(extractedText), requestOptions, 'flashcard generation');
  return parseJsonResponse(raw);
}

async function generateQuiz(extractedText, requestOptions = {}) {
  const raw = await generateWithFallback(buildQuizPrompt(extractedText), requestOptions, 'quiz generation');
  return parseJsonResponse(raw);
}

module.exports = {
  generateStudyGuide,
  generateKeyReferences,
  generateDiscussionQuestions,
  generateFlashcards,
  generateQuiz,
};
