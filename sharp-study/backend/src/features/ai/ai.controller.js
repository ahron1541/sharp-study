const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const { supabaseAdmin } = require('../../config/supabase');
const { sanitizeStudyGuideContent } = require('../../utils/studyGuideSanitize');
const {
  generateStudyGuide,
  generateKeyReferences,
  generateDiscussionQuestions,
  generateFlashcards,
  generateQuiz,
} = require('./ai.service');
const { invalidateDashboardCache } = require('../dashboard/dashboard.cache');
const { ACTIVITY_TYPES, recordStudyActivity } = require('../streaks/streaks.service');
const {
  buildSnapshot,
  cancelJob,
  enqueueJob,
  getJob,
  setProcessor,
  updateJob,
} = require('./ai.queue');

const AI_QUIZ_GENERATED_EVENT = 'ai.quiz.generated';
const AI_QUIZ_FAILED_EVENT = 'ai.quiz.failed';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only TXT, PDF, DOCX, and PPTX files are allowed.'));
    }
  },
}).single('file');

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/gi, '\n')
    .replace(/&#10;/g, '\n');
}

function getFileExtension(fileName = '') {
  const cleanName = String(fileName).trim().toLowerCase();
  const match = cleanName.match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
}

function looksLikeZipBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && buffer[2] === 0x03
    && buffer[3] === 0x04;
}

function resolveUploadKind(file) {
  const mime = String(file?.mimetype || '').toLowerCase();
  const extension = getFileExtension(file?.originalname);

  if (mime === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mime === 'text/plain' || extension === 'txt') return 'txt';
  if (mime.includes('wordprocessingml') || extension === 'docx') return 'docx';
  if (mime.includes('presentationml') || extension === 'pptx') return 'pptx';

  if (mime === 'application/vnd.ms-powerpoint') {
    return looksLikeZipBuffer(file?.buffer) || extension === 'pptx' ? 'pptx' : 'ppt';
  }

  return extension || 'unknown';
}

function normalizeForMatch(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function tokenizeContent(text = '') {
  return normalizeForMatch(text)
    .split(' ')
    .filter((token) => token.length >= 4);
}

function hasEnoughSourceOverlap(answer, supportSnippet, sourceText) {
  const normalizedSource = normalizeForMatch(sourceText);
  const normalizedSnippet = normalizeForMatch(supportSnippet);

  if (!normalizedSnippet || !normalizedSource.includes(normalizedSnippet)) {
    return false;
  }

  const answerTokens = Array.from(new Set(tokenizeContent(answer)));
  if (!answerTokens.length) {
    return false;
  }

  const overlapCount = answerTokens.filter((token) => normalizedSource.includes(token)).length;
  return overlapCount >= Math.min(3, answerTokens.length);
}

function sanitizeGeneratedPlainText(value = '', maxLength = 600) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function logAiQuizEvent(userId, event, metadata = {}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      event,
      metadata,
    });
  } catch (error) {
    console.error('[AI] Failed to record quiz generation audit event:', error.message);
  }
}

function normalizeGeneratedFlashcards(items = [], sourceText = '') {
  const seen = new Set();

  return items
    .map((item) => {
      const front = sanitizeGeneratedPlainText(item?.front, 260);
      const back = sanitizeGeneratedPlainText(item?.back, 520);
      const hint = sanitizeGeneratedPlainText(item?.hint, 180);
      const supportSnippet = sanitizeGeneratedPlainText(item?.support_snippet, 260);
      if (!front || !back) return null;
      if (!front.endsWith('?')) return null;
      if (/review the lesson|cannot determine|not provided|not mentioned|image|diagram/i.test(`${front} ${back}`)) {
        return null;
      }
      if (supportSnippet && !hasEnoughSourceOverlap(back, supportSnippet, sourceText)) {
        return null;
      }

      const key = normalizeForMatch(front);
      if (!key || seen.has(key)) return null;
      seen.add(key);

      return {
        front,
        back,
        hint: hint || `Think about the part of the lesson connected to ${front.replace(/\?$/, '').slice(0, 80)}.`,
      };
    })
    .filter(Boolean)
    .slice(0, 16);
}

function normalizeGeneratedQuiz(items = [], sourceText = '') {
  const seen = new Set();

  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const type = item?.type === 'identification' ? 'identification' : 'multiple_choice';
      let question = sanitizeGeneratedPlainText(item?.question, 420);
      const correctAnswer = sanitizeGeneratedPlainText(
        item?.correct_answer || (Array.isArray(item?.choices) ? item.choices[item?.correct_index] : ''),
        220
      );
      const explanation = sanitizeGeneratedPlainText(item?.explanation, 720);
      const supportSnippet = sanitizeGeneratedPlainText(item?.support_snippet, 300);

      if (type === 'identification' && /^(identify|what is being described|name the term|term described)/i.test(question)) {
        question = supportSnippet || `Definition or clue from the lesson for ${correctAnswer}.`;
      }

      if (!question || !correctAnswer) return null;
      if (/review the lesson|cannot determine|not provided|not mentioned|image|diagram/i.test(`${question} ${correctAnswer}`)) {
        return null;
      }
      if (supportSnippet && !hasEnoughSourceOverlap(correctAnswer, supportSnippet, sourceText)) {
        return null;
      }

      const key = normalizeForMatch(question);
      if (!key || seen.has(key)) return null;
      seen.add(key);

      if (type === 'identification') {
        if (correctAnswer.split(/\s+/).filter(Boolean).length > 8) return null;

        const acceptedAnswers = Array.from(new Set([
          correctAnswer,
          ...(Array.isArray(item?.accepted_answers) ? item.accepted_answers : []),
        ].map((answer) => sanitizeGeneratedPlainText(answer, 160)).filter(Boolean))).slice(0, 6);

        return {
          question,
          correct_index: 0,
          options: {
            type: 'identification',
            choices: [],
            correct_answer: correctAnswer,
            accepted_answers: acceptedAnswers.length ? acceptedAnswers : [correctAnswer],
            explanation: explanation || `The lesson supports "${correctAnswer}" as the answer.`,
            support_snippet: supportSnippet,
            order: index,
          },
        };
      }

      const choices = Array.isArray(item?.choices)
        ? item.choices.map((choice) => sanitizeGeneratedPlainText(choice, 180)).filter(Boolean)
        : Array.isArray(item?.options)
          ? item.options.map((choice) => sanitizeGeneratedPlainText(choice, 180).replace(/^[A-D]\.\s*/i, '')).filter(Boolean)
          : [];
      const uniqueChoices = Array.from(new Set(choices)).slice(0, 4);
      const correctIndex = Number.isInteger(item?.correct_index) ? item.correct_index : uniqueChoices.indexOf(correctAnswer);

      if (uniqueChoices.length !== 4 || correctIndex < 0 || correctIndex > 3) return null;

      const wrongExplanations = Array.isArray(item?.wrong_explanations)
        ? item.wrong_explanations.map((entry) => sanitizeGeneratedPlainText(entry, 220))
        : [];

      return {
        question,
        correct_index: correctIndex,
        options: {
          type: 'multiple_choice',
          choices: uniqueChoices,
          correct_answer: uniqueChoices[correctIndex] || correctAnswer,
          explanation: explanation || `The lesson supports "${uniqueChoices[correctIndex] || correctAnswer}" as the correct answer.`,
          wrong_explanations: uniqueChoices.map((choice, index) => (
            index === correctIndex
              ? ''
              : wrongExplanations[index] || `${choice} does not match the supporting lesson detail for this question.`
          )),
          support_snippet: supportSnippet,
          order: index,
        },
      };
    })
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeGeneratedDiscussionQuestions(items = [], sourceText = '') {
  return items
    .map((item, index) => {
      const question = String(item?.question || '').replace(/\s+/g, ' ').trim();
      const answer = String(item?.answer || '').replace(/\s+/g, ' ').trim();
      const supportSnippet = String(item?.support_snippet || '').replace(/\s+/g, ' ').trim();
      if (!question || !answer) return null;
      if (/self-check|think about|test your understanding|review the lesson|important points/i.test(answer)) {
        return null;
      }
      if (!hasEnoughSourceOverlap(answer, supportSnippet, sourceText)) {
        return null;
      }

      return {
        id: item?.id || `dq-ai-${index + 1}`,
        question: question.endsWith('?') ? question : `${question}?`,
        answer,
        supportSnippet,
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeGeneratedKeyReferences(groups = []) {
  return groups
    .map((group, groupIndex) => {
      const label = String(group?.label || '').replace(/\s+/g, ' ').trim();
      const items = Array.isArray(group?.items) ? group.items : [];
      if (!label || !items.length) return null;

      const normalizedItems = items
        .map((item, itemIndex) => {
          const title = String(item?.title || '').replace(/\s+/g, ' ').trim();
          const format = item?.format === 'ordered' ? 'ordered' : 'unordered';
          const entries = Array.isArray(item?.entries)
            ? item.entries
              .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
              .filter(Boolean)
              .slice(0, 6)
            : [];

          if (!title || !entries.length) return null;

          return {
            id: item?.id || `kr-${groupIndex + 1}-${itemIndex + 1}`,
            title,
            format,
            entries,
          };
        })
        .filter(Boolean)
        .slice(0, 3);

      if (!normalizedItems.length) return null;

      return {
        id: group?.id || `kr-group-${groupIndex + 1}`,
        label,
        items: normalizedItems,
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function serializeStudyGuideContent(html, metadata = {}) {
  const compactMetadata = JSON.stringify(metadata);
  return `<!--SHARP_STUDY_META:${compactMetadata}-->\n${String(html || '').trim()}`.trim();
}

function extractPptxText(buffer) {
  const zip = new AdmZip(buffer);
  const slideEntries = zip
    .getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName))
    .sort((a, b) => {
      const aNumber = Number(a.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const bNumber = Number(b.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return aNumber - bNumber;
    });

  const slides = slideEntries
    .map((entry) => {
      const xml = entry.getData().toString('utf8');
      const textRuns = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi))
        .map((match) => decodeXmlEntities(match[1]).trim())
        .filter(Boolean);

      return textRuns.join('\n').trim();
    })
    .filter(Boolean)
    .map((slideText, index) => `Slide ${index + 1}\n${slideText}`);

  return slides.join('\n\n').trim();
}

async function extractText(file) {
  const uploadKind = resolveUploadKind(file);

  if (uploadKind === 'pdf') {
    try {
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
      return result.text;
    } catch (err) {
      console.error('PDF parsing failed:', err);
      throw new Error('Failed to parse PDF document.');
    }
  }

  if (uploadKind === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return value;
  }

  if (uploadKind === 'txt') {
    return file.buffer.toString('utf8');
  }

  if (uploadKind === 'pptx') {
    try {
      return extractPptxText(file.buffer);
    } catch (err) {
      console.error('PPTX parsing failed:', err);
      throw new Error('Failed to parse PPTX document.');
    }
  }

  if (uploadKind === 'ppt') {
    throw new Error('Legacy PPT files are not supported yet. Please export or re-save the file as PPTX first.');
  }

  throw new Error('Unsupported document format. Please upload TXT, PDF, DOCX, or PPTX.');
}

async function processGenerationJob(job) {
  const { file, generateOptions, userId, sourceStudyGuideId } = job.payload;
  const docTitle = file?.originalname ? file.originalname.replace(/\.[^.]+$/, '') : '';
  let documentId = null;
  let sourceStudyGuide = null;

  console.log(`[AI Queue] Starting job ${job.id} for user ${userId}`);
  updateJob(job.id, {
    message: 'Extracting readable text',
    detail: sourceStudyGuideId ? 'Reading the saved study guide before creating the requested material.' : 'Looking for usable content from your document.',
    progressValue: 32,
  });

  let extractedText = '';
  if (sourceStudyGuideId) {
    const { data: guide, error: guideError } = await supabaseAdmin
      .from('study_guides')
      .select('id, user_id, document_id, title, content, document:documents(title, extracted_text)')
      .eq('id', sourceStudyGuideId)
      .eq('user_id', userId)
      .single();

    if (guideError || !guide) {
      throw new Error('Study guide not found.');
    }

    if (generateOptions.includes('flashcards')) {
      let existingSetQuery = supabaseAdmin
        .from('flashcard_sets')
        .select('id, title')
        .eq('user_id', userId)
        .eq('is_archived', false);

      existingSetQuery = guide.document_id
        ? existingSetQuery.eq('document_id', guide.document_id)
        : existingSetQuery.eq('source_study_guide_id', guide.id);

      const { data: existingSet, error: existingSetError } = await existingSetQuery.maybeSingle();
      if (existingSetError) throw existingSetError;
      if (existingSet) {
        return {
          success: true,
          generated: ['flashcards'],
          created: { flashcards: existingSet },
          alreadyExists: true,
        };
      }
    }

    if (generateOptions.includes('quiz')) {
      let existingQuizQuery = supabaseAdmin
        .from('quizzes')
        .select('id, title')
        .eq('user_id', userId)
        .eq('is_archived', false);

      existingQuizQuery = guide.document_id
        ? existingQuizQuery.eq('document_id', guide.document_id)
        : existingQuizQuery.is('document_id', null).eq('title', `Quiz: ${guide.title}`);

      const { data: existingQuiz, error: existingQuizError } = await existingQuizQuery.limit(1).maybeSingle();
      if (existingQuizError) throw existingQuizError;
      if (existingQuiz) {
        return {
          success: true,
          generated: ['quiz'],
          created: { quiz: existingQuiz },
          alreadyExists: true,
        };
      }
    }

    sourceStudyGuide = guide;
    extractedText = guide.document?.extracted_text || guide.content || '';
  } else {
    extractedText = await extractText(file);
  }

  const cleanedExtractedText = String(extractedText || '').replace(/\s+/g, ' ').trim();

  if (!cleanedExtractedText) {
    throw new Error('No readable text was found in this file. Please upload a text-based TXT, PDF, DOCX, or PPTX file with selectable text.');
  }

  if (cleanedExtractedText.length < 30) {
    throw new Error('Only a very small amount of readable text was found in this file. Please upload a clearer file with more selectable text.');
  }

  const resolvedType = file ? resolveUploadKind(file) : null;
  const fileType = resolvedType === 'pdf' || resolvedType === 'docx' || resolvedType === 'pptx'
    ? resolvedType
    : null;

  let doc = sourceStudyGuide?.document_id
    ? { id: sourceStudyGuide.document_id, title: sourceStudyGuide.document?.title || sourceStudyGuide.title }
    : null;

  if (!sourceStudyGuideId) {
    const { data: insertedDoc, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: userId,
        title: docTitle,
        file_type: fileType,
        file_size_bytes: file.size,
        extracted_text: cleanedExtractedText.substring(0, 50000),
        status: 'processing',
      })
      .select()
      .single();

    if (docError) throw docError;
    doc = insertedDoc;
    documentId = doc.id;
  }

  const requestOptions = { signal: job.abortController.signal };
  const createdRecords = {};

  try {
    if (generateOptions.includes('study_guide')) {
      updateJob(job.id, {
        message: 'Generating study guide',
        detail: 'Gemini AI is building your study guide and its discussion section.',
        progressValue: 64,
      });

      const content = await generateStudyGuide(cleanedExtractedText, requestOptions);
      let keyReferenceGroups = [];
      let discussionQuestions = [];

      try {
        const generatedKeyReferences = await generateKeyReferences(cleanedExtractedText, requestOptions);
        keyReferenceGroups = normalizeGeneratedKeyReferences(generatedKeyReferences);
      } catch (keyReferenceError) {
        console.warn('Key reference generation fell back to client builder:', keyReferenceError?.message || keyReferenceError);
      }

      try {
        const generatedQuestions = await generateDiscussionQuestions(cleanedExtractedText, requestOptions);
        discussionQuestions = normalizeGeneratedDiscussionQuestions(generatedQuestions, cleanedExtractedText);
        if (discussionQuestions.length < 3) {
          discussionQuestions = [];
        }
      } catch (discussionError) {
        console.warn('Discussion question generation fell back to client builder:', discussionError?.message || discussionError);
      }

      const serializedContent = sanitizeStudyGuideContent(serializeStudyGuideContent(content, {
        keyReferenceGroups,
        discussionQuestions,
      }));

      const { data: studyGuide, error: studyGuideError } = await supabaseAdmin
        .from('study_guides')
        .insert({
          user_id: userId,
          document_id: doc.id,
          title: `Study Guide: ${docTitle}`,
          content: serializedContent,
        })
        .select('id, title')
        .single();

      if (studyGuideError) throw studyGuideError;
      createdRecords.study_guide = studyGuide;
    }

    if (generateOptions.includes('flashcards')) {
      updateJob(job.id, {
        message: 'Generating flashcards',
        detail: 'Gemini AI is drafting question and answer cards, then the server checks support against the lesson.',
        progressValue: 64,
      });

      const generatedCards = await generateFlashcards(cleanedExtractedText, requestOptions);
      const cards = normalizeGeneratedFlashcards(generatedCards, cleanedExtractedText);
      if (!cards.length) {
        throw new Error('The AI response did not contain enough lesson-supported flashcards. Please try again with clearer lesson content.');
      }

      const { data: set, error: setError } = await supabaseAdmin
        .from('flashcard_sets')
        .insert({
          user_id: userId,
          document_id: doc?.id || null,
          source_study_guide_id: sourceStudyGuide?.id || null,
          title: `Flashcards: ${sourceStudyGuide?.title || docTitle}`,
        })
        .select()
        .single();

      if (setError) throw setError;

      if (set && cards && cards.length > 0) {
        const { error: cardsError } = await supabaseAdmin.from('flashcards').insert(
          cards.map((c) => ({ set_id: set.id, front: c.front, back: c.back, hint: c.hint || null }))
        );
        if (cardsError) {
          await supabaseAdmin.from('flashcard_sets').delete().eq('id', set.id);
          throw cardsError;
        }
      }

      createdRecords.flashcards = set ? { id: set.id, title: set.title } : null;
    }

    if (generateOptions.includes('quiz')) {
      updateJob(job.id, {
        message: 'Generating quiz',
        detail: 'Gemini AI is creating supported questions, answer keys, and explanations from your lesson.',
        progressValue: 64,
      });

      const generatedQuestions = await generateQuiz(cleanedExtractedText, requestOptions);
      const questions = normalizeGeneratedQuiz(generatedQuestions, cleanedExtractedText);
      if (!questions.length) {
        throw new Error('The AI response did not contain enough lesson-supported quiz questions. Please try again with clearer lesson content.');
      }

      const { data: quiz, error: quizError } = await supabaseAdmin
        .from('quizzes')
        .insert({
          user_id: userId,
          document_id: doc?.id || null,
          title: `Quiz: ${sourceStudyGuide?.title || docTitle}`,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      if (quiz && questions && questions.length > 0) {
        const { error: questionError } = await supabaseAdmin.from('quiz_questions').insert(
          questions.map((q) => ({
            quiz_id: quiz.id,
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
          }))
        );
        if (questionError) {
          await supabaseAdmin.from('quizzes').delete().eq('id', quiz.id);
          throw questionError;
        }
      }

      createdRecords.quiz = quiz ? { id: quiz.id, title: quiz.title } : null;
      await logAiQuizEvent(userId, AI_QUIZ_GENERATED_EVENT, {
        quiz_id: quiz?.id || null,
        quiz_title: quiz?.title || null,
        question_count: questions.length,
        source_study_guide_id: sourceStudyGuide?.id || null,
        document_id: doc?.id || null,
      });
    }

    if (!sourceStudyGuideId && doc?.id) {
      await supabaseAdmin.from('documents').update({ status: 'done' }).eq('id', doc.id);
    }

    if (typeof invalidateDashboardCache === 'function') {
      invalidateDashboardCache(userId);
    }
    await recordStudyActivity(userId, ACTIVITY_TYPES.AI_GENERATION);

    updateJob(job.id, {
      message: 'Finishing your library update',
      detail: 'Saving the result and refreshing your workspace.',
      progressValue: 92,
    });

    console.log(`[AI Queue] Completed job ${job.id} for user ${userId}`);
    return { success: true, generated: generateOptions, created: createdRecords };
  } catch (err) {
    console.error('AI generation error:', err);

    if (generateOptions.includes('quiz')) {
      await logAiQuizEvent(userId, AI_QUIZ_FAILED_EVENT, {
        source_study_guide_id: sourceStudyGuide?.id || sourceStudyGuideId || null,
        document_id: documentId || null,
        message: sanitizeGeneratedPlainText(err.message || 'Quiz generation failed.', 500),
        job_id: job.id,
      });
    }

    if (documentId) {
      await supabaseAdmin.from('documents').update({ status: 'error' }).eq('id', documentId);
    }

    if (err.status === 429 || err.status === 503 || (err.message && /(429|503)/.test(err.message))) {
      throw new Error('Gemini AI is busy right now. Please wait a bit and try again.');
    }

    throw err;
  }
}

setProcessor(processGenerationJob);

const generateMaterials = [
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },

  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const generateOptions = JSON.parse(req.body.generate || '[]');
      if (!generateOptions.length) {
        return res.status(400).json({ error: 'Select at least one generation option.' });
      }

      const abortController = new AbortController();
      const job = enqueueJob({
        userId: req.user.id,
        type: generateOptions[0],
        payload: {
          file,
          generateOptions,
          userId: req.user.id,
          abortController,
        },
      });

      return res.status(202).json({
        success: true,
        job,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message, job: err.job || null });
      }

      return res.status(500).json({ error: 'Could not queue the AI generation request.' });
    }
  },
];

async function generateFlashcardsFromStudyGuide(req, res) {
  try {
    const sourceStudyGuideId = String(req.params.id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceStudyGuideId)) {
      return res.status(400).json({ error: 'Invalid study guide id.' });
    }

    const abortController = new AbortController();
    const job = enqueueJob({
      userId: req.user.id,
      type: 'flashcards',
      payload: {
        file: null,
        generateOptions: ['flashcards'],
        userId: req.user.id,
        sourceStudyGuideId,
        abortController,
      },
    });

    return res.status(202).json({ success: true, job });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, job: err.job || null });
    }

    console.error('[AI] Could not queue study guide flashcards:', err.message);
    return res.status(500).json({ error: 'Could not queue flashcard generation for this study guide.' });
  }
}

async function generateQuizFromStudyGuide(req, res) {
  try {
    const sourceStudyGuideId = String(req.params.id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceStudyGuideId)) {
      return res.status(400).json({ error: 'Invalid study guide id.' });
    }

    const abortController = new AbortController();
    const job = enqueueJob({
      userId: req.user.id,
      type: 'quiz',
      payload: {
        file: null,
        generateOptions: ['quiz'],
        userId: req.user.id,
        sourceStudyGuideId,
        abortController,
      },
    });

    return res.status(202).json({ success: true, job });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, job: err.job || null });
    }

    console.error('[AI] Could not queue study guide quiz:', err.message);
    return res.status(500).json({ error: 'Could not queue quiz generation for this study guide.' });
  }
}

async function getGenerationStatus(req, res) {
  const job = getJob(req.params.jobId);
  if (!job || job.userId !== req.user.id) {
    return res.status(404).json({ error: 'Generation job not found.' });
  }

  return res.json({ success: true, job: buildSnapshot(job) });
}

async function cancelGeneration(req, res) {
  const job = cancelJob(req.params.jobId, req.user.id);
  if (!job) {
    return res.status(404).json({ error: 'Generation job not found.' });
  }

  return res.json({ success: true, job });
}

module.exports = {
  cancelGeneration,
  generateFlashcardsFromStudyGuide,
  generateMaterials,
  generateQuizFromStudyGuide,
  getGenerationStatus,
};
