const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Use v1 API and gemini-2.5-flash (the current free tier model)
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2048,
  }
});

/**
 * Wraps an API call with automatic retries for 503 errors.
 */
async function withRetry(apiCall, maxRetries = 3, initialDelayMs = 2000) {
  let delay = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      // If it's a 503 error AND we haven't run out of retries
      if (error.status === 503 && attempt < maxRetries) {
        console.warn(`[Attempt ${attempt}/${maxRetries}] Gemini API busy (503). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Double the delay for the next attempt
      } else {
        throw error;
      }
    }
  }
}

async function generateStudyGuide(extractedText) {
  const prompt = `
You are an accessibility-focused study coach for students with ADHD and Dyslexia.
Turn the lesson text into a clean, fast study guide that feels easy to review.
The HTML will be rendered directly in a study-guide reader with a heading-based sidebar, so the structure must be accurate and useful for navigation.

Output rules:
- Return semantic HTML only. No markdown, no code fences, no explanations.
- Use short sentences and simple language.
- Keep the guide concise, focused, and skimmable.
- Use these sections in this order:
  1. <h1>Title</h1>
  2. <h2>Overview</h2>
  3. <h2>Key Concepts</h2>
  4. <h2>Examples</h2>
  5. <h2>Quick Reference</h2>
  6. <h2>Self-Check</h2>
  7. <h2>Discussion Questions</h2>
- Use <h3> only for subheadings under a related <h2> section.
- Every heading must have real content underneath it. Do not create empty headings, placeholder labels, or sections that say nothing.
- Make the heading text specific, meaningful, and easy to jump to from a sidebar.
- Use <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, and <td> when useful.
- Bold the most important terms and names.
- Make Quick Reference a compact list or table of the most useful facts.
- In Quick Reference, prefer real structured review notes:
  - use <ul> for key terms, facts, definitions, examples, comparisons, people, and important details
  - use <ol> for steps, methods, sequences, timelines, stages, cause-to-effect chains, and procedures
  - avoid long paragraphs inside Quick Reference
  - each quick-reference group should be easy to scan in a few seconds
- Prefer quick reference groupings that match the lesson content, such as Key Terms/Concepts, Key People, Key Dates, Key Events, Cause and Effect, Formula/Steps, Comparisons, or Timeline.
- If the lesson naturally fits a table, use a simple accessible table with short headers and short cells.
- Do not force sections that do not fit the lesson. Only include the most useful quick-reference groups for this topic.
- Make the main study guide read like a reviewer: clear overview, short explanations, strong organization, and study-friendly wording.
- Put 5 to 7 discussion questions at the bottom.
- Prefer factual, study-friendly phrasing over filler prose.
- Keep the total output under 900 words.

Lesson text:
"""
${extractedText.substring(0, 8000)}
"""
  `;
  // Wrapped in withRetry
  const result = await withRetry(() => model.generateContent(prompt));
  return result.response.text();
}

async function generateFlashcards(extractedText) {
  const prompt = `
Create 10 flashcards from the text below.
Respond ONLY with a valid JSON array, no markdown, no explanation.
Format: [{ "front": "Question?", "back": "Short answer" }]

Text:
"""
${extractedText.substring(0, 6000)}
"""
  `;
  // Wrapped in withRetry
  const result = await withRetry(() => model.generateContent(prompt));
  const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function generateQuiz(extractedText) {
  const prompt = `
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
  // Wrapped in withRetry
  const result = await withRetry(() => model.generateContent(prompt));
  const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

module.exports = { generateStudyGuide, generateFlashcards, generateQuiz };
