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
You are an accessibility-focused study assistant for students with ADHD and Dyslexia.
Given the lesson text below, create a structured study guide.
Rules:
- Use short sentences (max 15 words each).
- Use simple language (Grade 7 reading level).
- Use numbered headings and bullet points.
- Put key terms in **bold**.
- Keep the total response under 800 words.
Respond in Markdown only.

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