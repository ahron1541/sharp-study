const express = require('express');
const { z } = require('zod');

const { supabaseAdmin } = require('../../config/supabase');
const { requireAuth } = require('../../middleware/auth.middleware');
const { sanitizePlainText } = require('../../utils/studyGuideSanitize');

const router = express.Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTEMPT_EVENT = 'quiz_attempt_submitted';

const submitAttemptSchema = z.object({
  session_type: z.enum(['practice', 'test']).default('test'),
  question_ids: z.array(z.string().uuid()).min(1).max(80),
  answers: z.array(z.object({
    question_id: z.string().uuid(),
    selected_index: z.number().int().min(0).max(3).nullable().optional(),
    answer_text: z.string().max(500).nullable().optional(),
  })).max(80),
  duration_seconds: z.number().int().min(0).max(24 * 60 * 60).default(0),
  timed_out: z.boolean().default(false),
  settings: z.object({
    question_type: z.enum(['mixed', 'multiple_choice', 'identification']).optional(),
    layout: z.enum(['single', 'page']).optional(),
    item_count: z.number().int().min(1).max(80).optional(),
    time_minutes: z.number().int().min(1).max(240).optional(),
  }).passthrough().optional(),
});

function parseStoredOptions(rawOptions, correctIndex = 0) {
  let options = rawOptions;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch {
      options = [];
    }
  }

  if (Array.isArray(options)) {
    const choices = options
      .map((choice) => sanitizePlainText(choice).replace(/^[A-D]\.\s*/i, ''))
      .filter(Boolean)
      .slice(0, 4);

    return {
      type: 'multiple_choice',
      choices,
      correctIndex: Math.max(0, Math.min(Number(correctIndex) || 0, choices.length - 1)),
      correctAnswer: choices[Math.max(0, Math.min(Number(correctIndex) || 0, choices.length - 1))] || '',
      acceptedAnswers: [],
      explanation: 'This answer is supported by the lesson material used to create the quiz.',
      wrongExplanations: [],
      supportSnippet: '',
    };
  }

  const objectOptions = options && typeof options === 'object' ? options : {};
  const type = objectOptions.type === 'identification' ? 'identification' : 'multiple_choice';
  const choices = Array.isArray(objectOptions.choices)
    ? objectOptions.choices.map((choice) => sanitizePlainText(choice)).filter(Boolean).slice(0, 4)
    : [];
  const safeCorrectIndex = Math.max(0, Math.min(Number(correctIndex) || 0, Math.max(choices.length - 1, 0)));
  const correctAnswer = sanitizePlainText(objectOptions.correct_answer || choices[safeCorrectIndex] || '');
  const acceptedAnswers = Array.from(new Set([
    correctAnswer,
    ...(Array.isArray(objectOptions.accepted_answers) ? objectOptions.accepted_answers : []),
  ].map((answer) => sanitizePlainText(answer)).filter(Boolean))).slice(0, 8);

  return {
    type,
    choices,
    correctIndex: safeCorrectIndex,
    correctAnswer,
    acceptedAnswers,
    explanation: sanitizePlainText(objectOptions.explanation || 'This answer is supported by the lesson material used to create the quiz.'),
    wrongExplanations: Array.isArray(objectOptions.wrong_explanations)
      ? objectOptions.wrong_explanations.map((entry) => sanitizePlainText(entry)).slice(0, 4)
      : [],
    supportSnippet: sanitizePlainText(objectOptions.support_snippet || ''),
  };
}

function normalizeQuestion(row) {
  const meta = parseStoredOptions(row.options, row.correct_index);
  return {
    id: row.id,
    quiz_id: row.quiz_id,
    question: sanitizePlainText(row.question),
    type: meta.type,
    choices: meta.choices,
    correct_index: meta.correctIndex,
    correct_answer: meta.correctAnswer,
    accepted_answers: meta.acceptedAnswers,
    explanation: meta.explanation,
    wrong_explanations: meta.wrongExplanations,
    support_snippet: meta.supportSnippet,
    created_at: row.created_at,
  };
}

function normalizeAnswer(value = '') {
  return sanitizePlainText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isIdentificationCorrect(answerText, question) {
  const normalizedAnswer = normalizeAnswer(answerText);
  if (!normalizedAnswer) return false;

  const accepted = (question.accepted_answers?.length ? question.accepted_answers : [question.correct_answer])
    .map((answer) => normalizeAnswer(answer))
    .filter(Boolean);

  return accepted.some((answer) => normalizedAnswer === answer);
}

function summarizeAttempt(row) {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    created_at: row.created_at,
    quiz_id: metadata.quiz_id,
    quiz_title: sanitizePlainText(metadata.quiz_title || ''),
    session_type: metadata.session_type === 'practice' ? 'practice' : 'test',
    score: Number(metadata.score || 0),
    total: Number(metadata.total || 0),
    percent: Number(metadata.percent || 0),
    duration_seconds: Number(metadata.duration_seconds || 0),
    timed_out: Boolean(metadata.timed_out),
  };
}

async function getQuizForUser(quizId, userId) {
  const { data: quiz, error: quizError } = await supabaseAdmin
    .from('quizzes')
    .select('id, user_id, document_id, title, is_archived, created_at')
    .eq('id', quizId)
    .eq('user_id', userId)
    .maybeSingle();

  if (quizError) throw quizError;
  return quiz || null;
}

router.use(requireAuth);

router.get('/:id', async (req, res) => {
  try {
    const quizId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz id.' });
    }

    const quiz = await getQuizForUser(quizId, req.user.id);
    if (!quiz || quiz.is_archived) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    const [{ data: questionRows, error: questionError }, { data: attemptRows, error: attemptError }] = await Promise.all([
      supabaseAdmin
        .from('quiz_questions')
        .select('id, quiz_id, question, options, correct_index, created_at')
        .eq('quiz_id', quiz.id)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('audit_logs')
        .select('id, metadata, created_at')
        .eq('user_id', req.user.id)
        .eq('event', ATTEMPT_EVENT)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (questionError) throw questionError;
    if (attemptError) throw attemptError;

    const questions = (questionRows || []).map(normalizeQuestion);
    const attempts = (attemptRows || [])
      .map(summarizeAttempt)
      .filter((attempt) => attempt.quiz_id === quiz.id)
      .slice(0, 20);

    return res.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: sanitizePlainText(quiz.title),
        document_id: quiz.document_id,
        created_at: quiz.created_at,
      },
      questions,
      attempts,
    });
  } catch (error) {
    console.error('[QUIZZES] Failed to load quiz:', error.message);
    return res.status(500).json({ error: 'Failed to load quiz.' });
  }
});

router.post('/:id/attempts', async (req, res) => {
  try {
    const quizId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz id.' });
    }

    const parsed = submitAttemptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid quiz attempt.' });
    }

    const quiz = await getQuizForUser(quizId, req.user.id);
    if (!quiz || quiz.is_archived) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    const { data: questionRows, error: questionError } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, quiz_id, question, options, correct_index, created_at')
      .eq('quiz_id', quiz.id)
      .in('id', parsed.data.question_ids);

    if (questionError) throw questionError;

    const questionsById = new Map((questionRows || []).map((row) => [row.id, normalizeQuestion(row)]));
    const selectedQuestions = parsed.data.question_ids.map((questionId) => questionsById.get(questionId)).filter(Boolean);
    if (selectedQuestions.length !== parsed.data.question_ids.length) {
      return res.status(400).json({ error: 'One or more questions do not belong to this quiz.' });
    }

    const answerByQuestionId = new Map(
      parsed.data.answers.map((answer) => [answer.question_id, answer])
    );

    const checkedAnswers = selectedQuestions.map((question, index) => {
      const answer = answerByQuestionId.get(question.id) || {};
      const selectedIndex = Number.isInteger(answer.selected_index) ? answer.selected_index : null;
      const answerText = sanitizePlainText(answer.answer_text || '');
      const userAnswer = question.type === 'multiple_choice'
        ? (selectedIndex === null ? '' : question.choices[selectedIndex] || '')
        : answerText;
      const isCorrect = question.type === 'multiple_choice'
        ? selectedIndex === question.correct_index
        : isIdentificationCorrect(answerText, question);

      return {
        order: index + 1,
        question_id: question.id,
        question: question.question,
        type: question.type,
        choices: question.choices,
        selected_index: selectedIndex,
        answer_text: answerText,
        user_answer: userAnswer,
        is_correct: Boolean(isCorrect),
        correct_index: question.correct_index,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        wrong_explanation: selectedIndex === null ? '' : (question.wrong_explanations?.[selectedIndex] || ''),
        support_snippet: question.support_snippet,
      };
    });

    const score = checkedAnswers.filter((answer) => answer.is_correct).length;
    const total = checkedAnswers.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const metadata = {
      quiz_id: quiz.id,
      quiz_title: sanitizePlainText(quiz.title),
      session_type: parsed.data.session_type,
      score,
      total,
      percent,
      duration_seconds: parsed.data.duration_seconds,
      timed_out: parsed.data.timed_out,
      settings: parsed.data.settings || {},
      answers: checkedAnswers,
    };

    const { data: log, error: logError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: req.user.id,
        event: ATTEMPT_EVENT,
        metadata,
      })
      .select('id, created_at')
      .single();

    if (logError) throw logError;

    return res.status(201).json({
      success: true,
      attempt: {
        id: log.id,
        created_at: log.created_at,
        ...metadata,
      },
    });
  } catch (error) {
    console.error('[QUIZZES] Failed to submit attempt:', error.message);
    return res.status(500).json({ error: 'Failed to submit quiz attempt.' });
  }
});

module.exports = router;
