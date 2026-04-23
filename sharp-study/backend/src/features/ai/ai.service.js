const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
  const result = await model.generateContent(prompt);
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
  const result = await model.generateContent(prompt);
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
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

module.exports = { generateStudyGuide, generateFlashcards, generateQuiz };