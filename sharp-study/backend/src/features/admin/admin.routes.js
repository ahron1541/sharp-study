const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const { requireAdmin } = require('../../middleware/auth.middleware');
const { supabaseAdmin } = require('../../config/supabase');
const { sanitizePlainText, sanitizeStudyGuideContent } = require('../../utils/studyGuideSanitize');
const { USERNAME_RULE_MESSAGE, normalizeUsername, isValidUsername } = require('../../utils/usernamePolicy');
const { setCache } = require('../../utils/cache');
const { writeSystemLog } = require('../../utils/systemLog');

const router = express.Router();

const USER_PAGE_SIZE = 10;
const CONTENT_PAGE_SIZE = 10;
const CONTENT_TYPES = new Set(['documents', 'study_guides', 'flashcard_sets', 'quizzes']);
const QUIZ_ATTEMPT_EVENT = 'quiz_attempt_submitted';
const AI_QUIZ_GENERATED_EVENT = 'ai.quiz.generated';
const AI_QUIZ_FAILED_EVENT = 'ai.quiz.failed';
const FEEDBACK_CONTENT_TYPES = new Set(['study_guide', 'flashcards', 'quiz']);
const FEEDBACK_STATUSES = new Set(['open', 'reviewing', 'resolved', 'dismissed']);
const ANNOUNCEMENT_STATUSES = new Set(['draft', 'published', 'archived']);
const ANNOUNCEMENT_CATEGORIES = new Set(['general', 'update', 'maintenance', 'feature', 'security']);
const ANNOUNCEMENT_PRIORITIES = new Set(['normal', 'high']);
const PROMPT_TEMPLATE_KEYS = new Set(['study_guide', 'key_references', 'discussion_questions', 'flashcards', 'quiz']);
const SYSTEM_LOG_LEVELS = new Set(['info', 'warning', 'error']);
const ADMIN_PASSWORD_RULES = [
  { test: (value) => value.length >= 8, message: 'Password must be at least 8 characters long.' },
  { test: (value) => /[A-Z]/.test(value), message: 'Password must include at least one uppercase letter.' },
  { test: (value) => /[a-z]/.test(value), message: 'Password must include at least one lowercase letter.' },
  { test: (value) => /[0-9]/.test(value), message: 'Password must include at least one number.' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), message: 'Password must include at least one special character.' },
];

const createUserSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  username: z.string().trim().transform(normalizeUsername).refine(isValidUsername, USERNAME_RULE_MESSAGE),
  first_name: z.string().trim().min(1).max(50),
  middle_name: z.string().trim().max(50).optional().default(''),
  last_name: z.string().trim().min(1).max(50),
  password: z.string().min(8).max(128),
  role: z.enum(['student', 'admin']).default('student'),
});

const updateUserSchema = z.object({
  role: z.enum(['student', 'admin']).optional(),
  is_blocked: z.boolean().optional(),
  username: z.string().trim().transform(normalizeUsername).refine(isValidUsername, USERNAME_RULE_MESSAGE).optional(),
  first_name: z.string().trim().min(1).max(50).optional(),
  middle_name: z.string().trim().max(50).optional(),
  last_name: z.string().trim().min(1).max(50).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required.',
});

const updateContentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  is_archived: z.boolean().optional(),
  status: z.enum(['processing', 'done', 'error']).optional(),
  content: z.string().trim().min(1).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required.',
});

const updateReportSchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']).optional(),
  admin_notes: z.string().trim().max(800).optional().default(''),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required.',
});

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  category: z.enum(['general', 'update', 'maintenance', 'feature', 'security']).default('general'),
  priority: z.enum(['normal', 'high']).default('normal'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});

const updateAnnouncementSchema = announcementSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required.',
});

const promptTemplateSchema = z.object({
  template_key: z.enum(['study_guide', 'key_references', 'discussion_questions', 'flashcards', 'quiz']),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(400).optional().default(''),
  content: z.string().trim().min(20).max(20000),
  is_active: z.boolean().default(false),
});

const updatePromptTemplateSchema = promptTemplateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required.',
});

const rateLimitSchema = z.object({
  daily_limit: z.number().int().min(1).max(500),
  window_hours: z.number().int().min(1).max(168).default(24),
});

const rateLimitOverrideSchema = z.object({
  user_id: z.string().uuid(),
  daily_limit: z.number().int().min(1).max(500),
  is_enabled: z.boolean().default(true),
});

router.use(requireAdmin);

function parsePositiveInt(value, fallback, max = 50) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildPagination(page, pageSize, totalCount) {
  const safeTotal = Number(totalCount || 0);
  return {
    page,
    pageSize,
    totalCount: safeTotal,
    totalPages: Math.max(1, Math.ceil(safeTotal / pageSize)),
  };
}

function paginateArray(rows, page, pageSize) {
  const from = (page - 1) * pageSize;
  return {
    items: rows.slice(from, from + pageSize),
    pagination: buildPagination(page, pageSize, rows.length),
  };
}

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

function ensureStrongPassword(password) {
  const failedRule = ADMIN_PASSWORD_RULES.find(({ test }) => !test(password));
  return failedRule ? failedRule.message : null;
}

async function logAuditEvent(userId, event, metadata = {}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      event,
      metadata,
    });
  } catch (error) {
    console.error('[AUDIT] Failed to record admin event:', error.message);
  }
}

function relationMissing(error) {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');
}

function safeIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePromptTemplate(row) {
  return {
    id: row.id,
    template_key: row.template_key,
    title: sanitizeAuditText(row.title || 'Prompt template', 160),
    description: sanitizeAuditText(row.description || '', 400),
    content: String(row.content || ''),
    is_active: Boolean(row.is_active),
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

function providerHealth() {
  return [
    {
      provider: 'Gemini',
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
      quota_available: null,
      quota_note: 'Gemini token/quota availability is not exposed by this backend.',
    },
    {
      provider: 'Groq',
      configured: Boolean(process.env.GROQ_API_KEY),
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      quota_available: null,
      quota_note: 'Fallback provider status only.',
    },
    {
      provider: 'OpenRouter',
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-001',
      quota_available: null,
      quota_note: 'Fallback provider status only.',
    },
  ];
}

function buildFullName(firstName, middleName, lastName) {
  return [firstName, middleName, lastName].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
}

async function fetchProfilesMap(userIds) {
  if (!userIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, username, role, is_blocked')
    .in('id', userIds);

  if (error) throw error;
  return new Map((data || []).map((profile) => [profile.id, profile]));
}

function summarizeProfile(profile, id, fallbackName = 'Unknown user') {
  return {
    id: id || null,
    name: sanitizeAuditText(profile?.full_name || profile?.username || profile?.email || fallbackName, 140),
    email: sanitizeAuditText(profile?.email || '', 180),
    role: profile?.role || null,
    is_blocked: Boolean(profile?.is_blocked),
  };
}

async function fetchFeedbackContentStats(contentType, contentId) {
  const [reactionsResult, reportCountResult] = await Promise.all([
    supabaseAdmin
      .from('ai_content_reactions')
      .select('reaction')
      .eq('content_type', contentType)
      .eq('content_id', contentId),
    supabaseAdmin
      .from('ai_content_reports')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', contentType)
      .eq('content_id', contentId),
  ]);

  if (relationMissing(reactionsResult.error) || relationMissing(reportCountResult.error)) {
    return {
      reaction_counts: { up: 0, down: 0 },
      report_count_for_content: 0,
    };
  }

  if (reactionsResult.error) throw reactionsResult.error;
  if (reportCountResult.error) throw reportCountResult.error;

  const reactions = reactionsResult.data || [];
  return {
    reaction_counts: {
      up: reactions.filter((item) => item.reaction === 'up').length,
      down: reactions.filter((item) => item.reaction === 'down').length,
    },
    report_count_for_content: reportCountResult.count || 0,
  };
}

async function fetchOverview(options = {}) {
  const aiPage = parsePositiveInt(options.aiPage, 1, 200);
  const aiPageSize = parsePositiveInt(options.aiPageSize, 5, 25);
  const activityPage = parsePositiveInt(options.activityPage, 1, 200);
  const activityPageSize = parsePositiveInt(options.activityPageSize, 6, 25);
  const activityFrom = (activityPage - 1) * activityPageSize;
  const activityTo = activityFrom + activityPageSize - 1;

  const [
    profilesResult,
    documentsResult,
    studyGuidesResult,
    flashcardSetsResult,
    quizzesResult,
    auditResult,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, role, is_blocked', { count: 'exact' }),
    supabaseAdmin.from('documents').select('id, status, is_archived', { count: 'exact' }),
    supabaseAdmin.from('study_guides').select('id, is_archived', { count: 'exact' }),
    supabaseAdmin.from('flashcard_sets').select('id, is_archived', { count: 'exact' }),
    supabaseAdmin.from('quizzes').select('id, is_archived', { count: 'exact' }),
    supabaseAdmin
      .from('audit_logs')
      .select('id, event, created_at, metadata, user_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(activityFrom, activityTo),
  ]);

  const errors = [
    profilesResult.error,
    documentsResult.error,
    studyGuidesResult.error,
    flashcardSetsResult.error,
    quizzesResult.error,
    auditResult.error,
  ].filter(Boolean);

  if (errors.length) {
    throw errors[0];
  }

  const profiles = profilesResult.data || [];
  const documents = documentsResult.data || [];
  const studyGuides = studyGuidesResult.data || [];
  const flashcardSets = flashcardSetsResult.data || [];
  const quizzes = quizzesResult.data || [];
  const audits = auditResult.data || [];
  let extraMetrics = {
    open_reports: 0,
    total_reports: 0,
    published_announcements: 0,
    ai_requests_window: 0,
    ai_failed_window: 0,
  };
  let topAiUsers = { items: [], pagination: buildPagination(aiPage, aiPageSize, 0) };

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [reportsResult, announcementsResult, aiEventsResult] = await Promise.all([
      supabaseAdmin.from('ai_content_reports').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('announcements').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('ai_request_events').select('id, user_id, status, feature, created_at').gte('created_at', since).limit(1000),
    ]);

    const optionalError = [reportsResult.error, announcementsResult.error, aiEventsResult.error].find(Boolean);
    if (optionalError) throw optionalError;

    const reportRows = reportsResult.data || [];
    const announcementRows = announcementsResult.data || [];
    const aiRows = aiEventsResult.data || [];
    const aiUserCounts = new Map();

    aiRows.forEach((event) => {
      if (!event.user_id) return;
      const current = aiUserCounts.get(event.user_id) || { user_id: event.user_id, requests: 0, failed: 0 };
      current.requests += 1;
      if (event.status === 'failed') current.failed += 1;
      aiUserCounts.set(event.user_id, current);
    });

    const aiUserIds = [...aiUserCounts.keys()];
    const profilesMap = await fetchProfilesMap(aiUserIds);
    const sortedAiUsers = [...aiUserCounts.values()]
      .map((entry) => {
        const profile = profilesMap.get(entry.user_id) || {};
        return {
          ...entry,
          user_name: sanitizeAuditText(profile.full_name || profile.username || profile.email || 'Unknown user', 140),
          email: sanitizeAuditText(profile.email || '', 180),
        };
      })
      .sort((a, b) => b.requests - a.requests || b.failed - a.failed);

    topAiUsers = paginateArray(sortedAiUsers, aiPage, aiPageSize);

    extraMetrics = {
      open_reports: reportRows.filter((item) => item.status === 'open').length,
      total_reports: reportsResult.count || reportRows.length,
      published_announcements: announcementRows.filter((item) => item.status === 'published').length,
      ai_requests_window: aiRows.length,
      ai_failed_window: aiRows.filter((item) => item.status === 'failed').length,
    };
  } catch (error) {
    if (!relationMissing(error)) {
      await writeSystemLog({
        level: 'warning',
        source: 'admin.overview',
        message: 'Admin overview optional metrics could not be loaded.',
        metadata: { error: error.message },
      });
    }
  }

  return {
    metrics: {
      total_users: profilesResult.count || profiles.length,
      admins: profiles.filter((profile) => profile.role === 'admin').length,
      blocked_users: profiles.filter((profile) => profile.is_blocked).length,
      active_users: profiles.filter((profile) => !profile.is_blocked).length,
      documents: documentsResult.count || documents.length,
      documents_active: documents.filter((doc) => !doc.is_archived).length,
      documents_archived: documents.filter((doc) => doc.is_archived).length,
      study_guides: studyGuidesResult.count || studyGuides.length,
      study_guides_active: studyGuides.filter((item) => !item.is_archived).length,
      study_guides_archived: studyGuides.filter((item) => item.is_archived).length,
      flashcard_sets: flashcardSetsResult.count || flashcardSets.length,
      flashcard_sets_active: flashcardSets.filter((item) => !item.is_archived).length,
      flashcard_sets_archived: flashcardSets.filter((item) => item.is_archived).length,
      quizzes: quizzesResult.count || quizzes.length,
      quizzes_active: quizzes.filter((item) => !item.is_archived).length,
      quizzes_archived: quizzes.filter((item) => item.is_archived).length,
      documents_processing: documents.filter((doc) => doc.status === 'processing').length,
      documents_done: documents.filter((doc) => doc.status === 'done').length,
      documents_error: documents.filter((doc) => doc.status === 'error').length,
      ...extraMetrics,
    },
    recent_activity: {
      items: audits,
      pagination: buildPagination(activityPage, activityPageSize, auditResult.count || audits.length),
    },
    top_ai_users: topAiUsers,
  };
}

function getAttemptPercent(metadata = {}) {
  const explicitPercent = Number(metadata.percent);
  if (Number.isFinite(explicitPercent)) return Math.max(0, Math.min(100, Math.round(explicitPercent)));

  const score = Number(metadata.score || 0);
  const total = Number(metadata.total || 0);
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function sanitizeAuditText(value = '', maxLength = 300) {
  return sanitizePlainText(value).slice(0, maxLength);
}

async function fetchLearningInsights() {
  const [attemptsResult, generationResult] = await Promise.all([
    supabaseAdmin
      .from('audit_logs')
      .select('id, user_id, event, metadata, created_at')
      .eq('event', QUIZ_ATTEMPT_EVENT)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('audit_logs')
      .select('id, user_id, event, metadata, created_at')
      .in('event', [AI_QUIZ_GENERATED_EVENT, AI_QUIZ_FAILED_EVENT])
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (attemptsResult.error) throw attemptsResult.error;
  if (generationResult.error) throw generationResult.error;

  const attempts = attemptsResult.data || [];
  const generationEvents = generationResult.data || [];
  const userIds = [...new Set([
    ...attempts.map((row) => row.user_id),
    ...generationEvents.map((row) => row.user_id),
  ].filter(Boolean))];
  const profilesMap = await fetchProfilesMap(userIds);

  const attemptPercents = attempts.map((row) => getAttemptPercent(row.metadata || {}));
  const averageScore = attemptPercents.length
    ? Math.round(attemptPercents.reduce((sum, value) => sum + value, 0) / attemptPercents.length)
    : 0;

  const lowScoreUsers = new Map();
  const missedQuestions = new Map();

  attempts.forEach((row) => {
    const metadata = row.metadata || {};
    const percent = getAttemptPercent(metadata);
    const profile = profilesMap.get(row.user_id) || {};

    if (percent < 60) {
      const current = lowScoreUsers.get(row.user_id) || {
        user_id: row.user_id,
        user_name: sanitizeAuditText(profile.full_name || profile.username || profile.email || 'Unknown user', 120),
        email: sanitizeAuditText(profile.email || '', 180),
        attempts: 0,
        latest_score: percent,
        latest_at: row.created_at,
        total_percent: 0,
      };
      current.attempts += 1;
      current.total_percent += percent;
      if (new Date(row.created_at).getTime() > new Date(current.latest_at).getTime()) {
        current.latest_score = percent;
        current.latest_at = row.created_at;
      }
      lowScoreUsers.set(row.user_id, current);
    }

    (Array.isArray(metadata.answers) ? metadata.answers : []).forEach((answer) => {
      if (answer?.is_correct) return;
      const key = answer?.question_id || sanitizeAuditText(answer?.question || '', 180);
      if (!key) return;
      const current = missedQuestions.get(key) || {
        question_id: answer?.question_id || null,
        question: sanitizeAuditText(answer?.question || '', 220),
        correct_answer: sanitizeAuditText(answer?.correct_answer || '', 160),
        quiz_id: metadata.quiz_id || null,
        quiz_title: sanitizeAuditText(metadata.quiz_title || '', 180),
        missed_count: 0,
      };
      current.missed_count += 1;
      missedQuestions.set(key, current);
    });
  });

  const recentAttempts = attempts.slice(0, 12).map((row) => {
    const metadata = row.metadata || {};
    const profile = profilesMap.get(row.user_id) || {};
    return {
      id: row.id,
      user_id: row.user_id,
      user_name: sanitizeAuditText(profile.full_name || profile.username || profile.email || 'Unknown user', 120),
      quiz_id: metadata.quiz_id || null,
      quiz_title: sanitizeAuditText(metadata.quiz_title || 'Quiz', 180),
      score: Number(metadata.score || 0),
      total: Number(metadata.total || 0),
      percent: getAttemptPercent(metadata),
      duration_seconds: Number(metadata.duration_seconds || 0),
      session_type: metadata.session_type === 'practice' ? 'practice' : 'test',
      timed_out: Boolean(metadata.timed_out),
      created_at: row.created_at,
    };
  });

  const failures = generationEvents
    .filter((row) => row.event === AI_QUIZ_FAILED_EVENT)
    .slice(0, 12)
    .map((row) => {
      const metadata = row.metadata || {};
      const profile = profilesMap.get(row.user_id) || {};
      return {
        id: row.id,
        user_id: row.user_id,
        user_name: sanitizeAuditText(profile.full_name || profile.username || profile.email || 'Unknown user', 120),
        message: sanitizeAuditText(metadata.message || 'Quiz generation failed.', 280),
        source_study_guide_id: metadata.source_study_guide_id || null,
        document_id: metadata.document_id || null,
        created_at: row.created_at,
      };
    });

  return {
    metrics: {
      attempt_count: attempts.length,
      average_score: averageScore,
      low_score_attempts: attempts.filter((row) => getAttemptPercent(row.metadata || {}) < 60).length,
      quiz_generation_successes: generationEvents.filter((row) => row.event === AI_QUIZ_GENERATED_EVENT).length,
      quiz_generation_failures: generationEvents.filter((row) => row.event === AI_QUIZ_FAILED_EVENT).length,
    },
    low_score_users: [...lowScoreUsers.values()]
      .map(({ total_percent: totalPercent, ...entry }) => ({
        ...entry,
        average_score: entry.attempts ? Math.round(totalPercent / entry.attempts) : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts || a.average_score - b.average_score)
      .slice(0, 10),
    most_missed_questions: [...missedQuestions.values()]
      .sort((a, b) => b.missed_count - a.missed_count)
      .slice(0, 10),
    recent_attempts: recentAttempts,
    generation_failures: failures,
  };
}

router.get('/overview', async (req, res) => {
  try {
    const overview = await fetchOverview({
      aiPage: req.query.aiPage,
      aiPageSize: req.query.aiPageSize,
      activityPage: req.query.activityPage,
      activityPageSize: req.query.activityPageSize,
    });
    res.json(overview);
  } catch (error) {
    console.error('[ADMIN] Failed to fetch overview:', error.message);
    res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

router.get('/learning-insights', async (req, res) => {
  try {
    const insights = await fetchLearningInsights();
    res.json(insights);
  } catch (error) {
    console.error('[ADMIN] Failed to fetch learning insights:', error.message);
    res.status(500).json({ error: 'Failed to load learning insights.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, USER_PAGE_SIZE, 25);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const search = normalizeSearch(req.query.search);
    const role = String(req.query.role || 'all').trim();
    const status = String(req.query.status || 'all').trim();

    let query = supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, username, first_name, middle_name, last_name, role, is_blocked, created_at, login_attempts, locked_until', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (role !== 'all') {
      query = query.eq('role', role);
    }

    if (status === 'blocked') {
      query = query.eq('is_blocked', true);
    } else if (status === 'active') {
      query = query.eq('is_blocked', false);
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    res.json({
      users: data || [],
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      },
    });
  } catch (error) {
    console.error('[ADMIN] Failed to fetch users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid user payload.' });
    }

    const payload = parsed.data;
    const passwordError = ensureStrongPassword(payload.password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', payload.email)
      .maybeSingle();

    if (existingEmail) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const { data: existingUsername } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', payload.username)
      .maybeSingle();

    if (existingUsername) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
    });

    if (authError || !authUser?.user?.id) {
      throw authError || new Error('Failed to create auth account.');
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const fullName = buildFullName(payload.first_name, payload.middle_name, payload.last_name);

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: authUser.user.id,
      email: payload.email,
      username: payload.username,
      first_name: payload.first_name,
      middle_name: payload.middle_name,
      last_name: payload.last_name,
      full_name: fullName,
      role: payload.role,
      password_hash: passwordHash,
    }, { onConflict: 'id' });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    setCache(`auth:username:${payload.username}`, { available: false }, 30);

    await logAuditEvent(req.user.id, 'admin.user.created', {
      target_user_id: authUser.user.id,
      target_email: payload.email,
      role: payload.role,
    });

    res.status(201).json({
      success: true,
      user: {
        id: authUser.user.id,
        email: payload.email,
        username: payload.username,
        full_name: fullName,
        role: payload.role,
        is_blocked: false,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Failed to create user:', error.message);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update payload.' });
    }

    const targetId = req.params.id;
    if (targetId === req.user.id) {
      if (parsed.data.role === 'student' || parsed.data.is_blocked === true) {
        return res.status(400).json({ error: 'You cannot demote or block your own admin account.' });
      }
    }

    const { data: currentProfile, error: currentError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, middle_name, last_name, full_name, username, role, is_blocked')
      .eq('id', targetId)
      .single();

    if (currentError || !currentProfile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const nextProfile = {
      role: parsed.data.role ?? currentProfile.role,
      is_blocked: parsed.data.is_blocked ?? currentProfile.is_blocked,
      username: parsed.data.username ?? currentProfile.username,
      first_name: parsed.data.first_name ?? currentProfile.first_name,
      middle_name: parsed.data.middle_name ?? currentProfile.middle_name,
      last_name: parsed.data.last_name ?? currentProfile.last_name,
    };

    if (nextProfile.username !== currentProfile.username) {
      const { data: usernameOwner } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', nextProfile.username)
        .neq('id', targetId)
        .maybeSingle();

      if (usernameOwner) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }
    }

    const fullName = buildFullName(nextProfile.first_name, nextProfile.middle_name, nextProfile.last_name);
    const updatePayload = { ...nextProfile, full_name: fullName };

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', targetId)
      .select('id, email, full_name, username, first_name, middle_name, last_name, role, is_blocked, created_at, login_attempts, locked_until')
      .single();

    if (error) throw error;

    setCache(`auth:username:${data.username}`, { available: false }, 30);

    await logAuditEvent(req.user.id, 'admin.user.updated', {
      target_user_id: targetId,
      changes: parsed.data,
    });

    res.json({ success: true, user: data });
  } catch (error) {
    console.error('[ADMIN] Failed to update user:', error.message);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

async function deleteUserOwnedData(targetId, targetEmail = '') {
  const [{ data: sets }, { data: quizzes }] = await Promise.all([
    supabaseAdmin.from('flashcard_sets').select('id').eq('user_id', targetId),
    supabaseAdmin.from('quizzes').select('id').eq('user_id', targetId),
  ]);
  const setIds = (sets || []).map((item) => item.id);
  const quizIds = (quizzes || []).map((item) => item.id);

  if (setIds.length) {
    await supabaseAdmin.from('flashcard_attempts').delete().in('set_id', setIds);
    await supabaseAdmin.from('flashcard_progress').delete().in('set_id', setIds);
    await supabaseAdmin.from('flashcards').delete().in('set_id', setIds);
  }

  if (quizIds.length) {
    await supabaseAdmin.from('quiz_questions').delete().in('quiz_id', quizIds);
  }

  const cleanupTasks = [
    supabaseAdmin.from('ai_content_reactions').delete().eq('user_id', targetId),
    supabaseAdmin.from('ai_content_reports').delete().or(`user_id.eq.${targetId},content_owner_id.eq.${targetId}`),
    supabaseAdmin.from('announcement_reads').delete().eq('user_id', targetId),
    supabaseAdmin.from('ai_request_events').delete().eq('user_id', targetId),
    supabaseAdmin.from('ai_rate_limit_overrides').delete().eq('user_id', targetId),
    supabaseAdmin.from('flashcard_sets').delete().eq('user_id', targetId),
    supabaseAdmin.from('quizzes').delete().eq('user_id', targetId),
    supabaseAdmin.from('study_guides').delete().eq('user_id', targetId),
    supabaseAdmin.from('documents').delete().eq('user_id', targetId),
    supabaseAdmin.from('study_activity_days').delete().eq('user_id', targetId),
    supabaseAdmin.from('user_streaks').delete().eq('user_id', targetId),
    supabaseAdmin.from('password_history').delete().eq('user_id', targetId),
    supabaseAdmin.from('audit_logs').delete().eq('user_id', targetId),
    supabaseAdmin.from('profiles').delete().eq('id', targetId),
  ];

  if (targetEmail) {
    cleanupTasks.push(supabaseAdmin.from('login_attempts').delete().eq('email', targetEmail));
    cleanupTasks.push(supabaseAdmin.from('otp_codes').delete().eq('email', targetEmail));
  }

  for (const task of cleanupTasks) {
    const { error } = await task;
    if (error && !relationMissing(error)) throw error;
  }
}

router.delete('/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', targetId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await deleteUserOwnedData(targetId, profile.email);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (error) throw error;

    await logAuditEvent(req.user.id, 'admin.user.deleted', {
      target_user_id: targetId,
      privacy_cleanup: true,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete user:', error.message);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

async function fetchContentPage({ type, search, page, pageSize, archived = 'all', ownerSearch = '', ownerId = '' }) {
  const normalizedType = CONTENT_TYPES.has(type) ? type : 'all';
  const queries = normalizedType === 'all' ? [...CONTENT_TYPES] : [normalizedType];
  const rows = [];

  for (const queryType of queries) {
    const fields = queryType === 'documents'
      ? 'id, user_id, title, created_at, is_archived, file_type, status, file_url'
      : queryType === 'study_guides'
        ? 'id, user_id, title, created_at, is_archived, document_id, content'
        : 'id, user_id, title, created_at, is_archived, document_id';

    let query = supabaseAdmin
      .from(queryType)
      .select(fields)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

     if (archived === 'archived') {
      query = query.eq('is_archived', true);
    } else if (archived === 'active') {
      query = query.eq('is_archived', false);
    }

    if (ownerId) {
      query = query.eq('user_id', ownerId);
    }

    const { data, error } = await query.limit(normalizedType === 'all' ? 1000 : pageSize * 3);
    if (error) throw error;

    for (const item of data || []) {
      rows.push({
        ...item,
        type: queryType,
      });
    }
  }

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalCount = rows.length;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const userIds = [...new Set(rows.map((item) => item.user_id).filter(Boolean))];
  const profilesMap = await fetchProfilesMap(userIds);
  const hydratedRows = rows.map((item) => ({
    ...item,
    owner: profilesMap.get(item.user_id) || null,
  }));

  const filteredRows = ownerSearch
    ? hydratedRows.filter((item) => {
      const haystack = [
        item.owner?.full_name,
        item.owner?.email,
        item.owner?.username,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(ownerSearch);
    })
    : hydratedRows;

  const filteredTotalCount = filteredRows.length;
  const pageItems = filteredRows.slice(from, to);

  return {
    items: pageItems,
    totalCount: filteredTotalCount,
    totalPages: Math.max(1, Math.ceil(filteredTotalCount / pageSize)),
  };
}

async function fetchContentItem(type, id) {
  if (!CONTENT_TYPES.has(type)) {
    throw new Error('Unsupported content type.');
  }

  const fields = type === 'documents'
    ? 'id, user_id, title, created_at, is_archived, file_type, status, file_url, file_size_bytes, extracted_text'
    : type === 'study_guides'
      ? 'id, user_id, title, created_at, is_archived, document_id, content'
      : 'id, user_id, title, created_at, is_archived, document_id';

  const { data, error } = await supabaseAdmin
    .from(type)
    .select(fields)
    .eq('id', id)
    .single();

  if (error) throw error;

  const profilesMap = await fetchProfilesMap(data?.user_id ? [data.user_id] : []);

  return {
    ...data,
    type,
    owner: profilesMap.get(data.user_id) || null,
  };
}

async function fetchReportedContent(report) {
  if (!report?.content_type || !report?.content_id) return null;

  if (report.content_type === 'study_guide') {
    const { data, error } = await supabaseAdmin
      .from('study_guides')
      .select('id, user_id, title, created_at, is_archived, document_id, content')
      .eq('id', report.content_id)
      .maybeSingle();

    if (error) throw error;
    return data ? { ...data, type: 'study_guide' } : null;
  }

  if (report.content_type === 'flashcards') {
    const { data, error } = await supabaseAdmin
      .from('flashcard_sets')
      .select('id, user_id, title, created_at, is_archived, document_id, source_study_guide_id, difficulty')
      .eq('id', report.content_id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('flashcards')
      .select('id, front, back, hint, difficulty, created_at')
      .eq('set_id', data.id)
      .order('created_at', { ascending: true });

    if (cardsError) throw cardsError;
    return { ...data, type: 'flashcards', cards: cards || [] };
  }

  if (report.content_type === 'quiz') {
    const { data, error } = await supabaseAdmin
      .from('quizzes')
      .select('id, user_id, title, created_at, is_archived, document_id, difficulty')
      .eq('id', report.content_id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, question, options, correct_index, difficulty, created_at')
      .eq('quiz_id', data.id)
      .order('created_at', { ascending: true });

    if (questionsError) throw questionsError;
    return { ...data, type: 'quiz', questions: questions || [] };
  }

  return null;
}

async function hydrateFeedbackReport(report, options = {}) {
  const includeContent = Boolean(options.includeContent);
  const userIds = [
    report.user_id,
    report.content_owner_id,
    report.resolved_by,
  ].filter(Boolean);
  const profilesMap = options.profilesMap || await fetchProfilesMap([...new Set(userIds)]);
  const [stats, content] = await Promise.all([
    fetchFeedbackContentStats(report.content_type, report.content_id),
    includeContent ? fetchReportedContent(report) : Promise.resolve(undefined),
  ]);

  return {
    ...report,
    reporter: summarizeProfile(profilesMap.get(report.user_id), report.user_id, 'Unknown user'),
    owner: summarizeProfile(profilesMap.get(report.content_owner_id), report.content_owner_id, 'Unknown owner'),
    resolved_by_admin: report.resolved_by
      ? summarizeProfile(profilesMap.get(report.resolved_by), report.resolved_by, 'Unknown admin')
      : null,
    reaction_counts: stats.reaction_counts,
    report_count_for_content: stats.report_count_for_content,
    ...(includeContent ? { content } : {}),
  };
}

router.get('/content', async (req, res) => {
  try {
    const type = String(req.query.type || 'all').trim();
    const search = normalizeSearch(req.query.search);
    const ownerSearch = normalizeSearch(req.query.owner);
    const ownerId = String(req.query.owner_id || '').trim();
    const archived = ['all', 'active', 'archived'].includes(String(req.query.archived || 'all'))
      ? String(req.query.archived || 'all')
      : 'all';
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, CONTENT_PAGE_SIZE, 100);
    const result = await fetchContentPage({ type, search, page, pageSize, archived, ownerSearch, ownerId });

    res.json({
      items: result.items,
      pagination: {
        page,
        pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Failed to fetch content:', error.message);
    res.status(500).json({ error: 'Failed to fetch content.' });
  }
});

router.get('/content/:type/:id', async (req, res) => {
  try {
    const type = String(req.params.type || '').trim();
    const id = String(req.params.id || '').trim();

    if (!CONTENT_TYPES.has(type)) {
      return res.status(400).json({ error: 'Unsupported content type.' });
    }

    const item = await fetchContentItem(type, id);
    res.json({ item });
  } catch (error) {
    console.error('[ADMIN] Failed to fetch content item:', error.message);
    res.status(500).json({ error: 'Failed to fetch content item.' });
  }
});

router.patch('/content/:type/:id', async (req, res) => {
  try {
    const type = String(req.params.type || '').trim();
    if (!CONTENT_TYPES.has(type)) {
      return res.status(400).json({ error: 'Unsupported content type.' });
    }

    const parsed = updateContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid content update.' });
    }

    const payload = { ...parsed.data };
    if (type !== 'documents') {
      delete payload.status;
    }
    if (type !== 'study_guides') {
      delete payload.content;
    } else if (payload.content) {
      payload.content = sanitizeStudyGuideContent(payload.content);
    }

    const { data, error } = await supabaseAdmin
      .from(type)
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;

    await logAuditEvent(req.user.id, 'admin.content.updated', {
      type,
      target_id: req.params.id,
      changes: payload,
    });

    res.json({ success: true, item: data });
  } catch (error) {
    console.error('[ADMIN] Failed to update content:', error.message);
    res.status(500).json({ error: 'Failed to update content.' });
  }
});

router.delete('/content/:type/:id', async (req, res) => {
  try {
    const type = String(req.params.type || '').trim();
    const id = req.params.id;

    if (!CONTENT_TYPES.has(type)) {
      return res.status(400).json({ error: 'Unsupported content type.' });
    }

    if (type === 'flashcard_sets') {
      const { error: cardsError } = await supabaseAdmin.from('flashcards').delete().eq('set_id', id);
      if (cardsError) throw cardsError;
    }

    if (type === 'quizzes') {
      const { error: questionsError } = await supabaseAdmin.from('quiz_questions').delete().eq('quiz_id', id);
      if (questionsError) throw questionsError;
    }

    if (type === 'documents') {
      const updates = [
        supabaseAdmin.from('study_guides').update({ document_id: null }).eq('document_id', id),
        supabaseAdmin.from('flashcard_sets').update({ document_id: null }).eq('document_id', id),
        supabaseAdmin.from('quizzes').update({ document_id: null }).eq('document_id', id),
      ];
      const results = await Promise.all(updates);
      const updateError = results.find((result) => result.error)?.error;
      if (updateError) throw updateError;
    }

    const { error } = await supabaseAdmin.from(type).delete().eq('id', id);
    if (error) throw error;

    await logAuditEvent(req.user.id, 'admin.content.deleted', {
      type,
      target_id: id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete content:', error.message);
    res.status(500).json({ error: 'Failed to delete content.' });
  }
});

router.get('/feedback', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 10, 50);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const status = String(req.query.status || 'all').trim();
    const type = String(req.query.type || 'all').trim();
    const search = normalizeSearch(req.query.search);

    let query = supabaseAdmin
      .from('ai_content_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (FEEDBACK_STATUSES.has(status)) query = query.eq('status', status);
    if (FEEDBACK_CONTENT_TYPES.has(type)) query = query.eq('content_type', type);
    if (search) query = query.or(`content_title.ilike.%${search}%,details.ilike.%${search}%`);

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const reports = data || [];
    const userIds = [...new Set(reports.flatMap((report) => [
      report.user_id,
      report.content_owner_id,
      report.resolved_by,
    ]).filter(Boolean))];
    const profilesMap = await fetchProfilesMap(userIds);

    const hydrated = await Promise.all(reports.map((report) => hydrateFeedbackReport(report, { profilesMap })));

    res.json({
      reports: hydrated,
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      },
    });
  } catch (error) {
    if (relationMissing(error)) {
      return res.json({ reports: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } });
    }
    console.error('[ADMIN] Failed to fetch feedback:', error.message);
    res.status(500).json({ error: 'Failed to load feedback reports.' });
  }
});

router.get('/feedback/:id', async (req, res) => {
  try {
    const reportId = String(req.params.id || '').trim();
    if (!z.string().uuid().safeParse(reportId).success) {
      return res.status(400).json({ error: 'Invalid report id.' });
    }

    const { data: report, error } = await supabaseAdmin
      .from('ai_content_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (error) throw error;
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const hydrated = await hydrateFeedbackReport(report, { includeContent: true });
    return res.json({ report: hydrated });
  } catch (error) {
    if (relationMissing(error)) {
      return res.status(404).json({ error: 'Report data is not available.' });
    }
    console.error('[ADMIN] Failed to load feedback report:', error.message);
    return res.status(500).json({ error: 'Failed to load feedback report.' });
  }
});

router.patch('/feedback/:id', async (req, res) => {
  try {
    const parsed = updateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report update.' });
    }

    const payload = { updated_at: new Date().toISOString() };
    if (parsed.data.status) {
      payload.status = parsed.data.status;
      if (['resolved', 'dismissed'].includes(parsed.data.status)) {
        payload.resolved_by = req.user.id;
        payload.resolved_at = new Date().toISOString();
      } else {
        payload.resolved_by = null;
        payload.resolved_at = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'admin_notes')) {
      payload.admin_notes = sanitizeAuditText(parsed.data.admin_notes || '', 800) || null;
    }

    const { data, error } = await supabaseAdmin
      .from('ai_content_reports')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.feedback.updated', { report_id: req.params.id, changes: payload });
    res.json({ success: true, report: data });
  } catch (error) {
    console.error('[ADMIN] Failed to update feedback report:', error.message);
    res.status(500).json({ error: 'Failed to update feedback report.' });
  }
});

router.delete('/feedback/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('ai_content_reports').delete().eq('id', req.params.id);
    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.feedback.deleted', { report_id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete feedback report:', error.message);
    res.status(500).json({ error: 'Failed to delete feedback report.' });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const status = String(req.query.status || 'all').trim();
    let query = supabaseAdmin
      .from('announcements')
      .select('*')
      .order('updated_at', { ascending: false });

    if (ANNOUNCEMENT_STATUSES.has(status)) query = query.eq('status', status);

    const { data, error } = await query.limit(100);
    if (error) throw error;
    res.json({ announcements: data || [] });
  } catch (error) {
    if (relationMissing(error)) return res.json({ announcements: [] });
    console.error('[ADMIN] Failed to fetch announcements:', error.message);
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid announcement.' });
    }

    const payload = {
      ...parsed.data,
      title: sanitizeAuditText(parsed.data.title, 160),
      body: sanitizeAuditText(parsed.data.body, 2000),
      starts_at: safeIsoDate(parsed.data.starts_at),
      ends_at: safeIsoDate(parsed.data.ends_at),
      created_by: req.user.id,
      updated_by: req.user.id,
    };

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.announcement.created', { announcement_id: data.id, status: data.status });
    res.status(201).json({ success: true, announcement: data });
  } catch (error) {
    console.error('[ADMIN] Failed to create announcement:', error.message);
    res.status(500).json({ error: 'Failed to create announcement.' });
  }
});

router.patch('/announcements/:id', async (req, res) => {
  try {
    const parsed = updateAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid announcement update.' });
    }

    const payload = {
      ...parsed.data,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    };
    if (payload.title) payload.title = sanitizeAuditText(payload.title, 160);
    if (payload.body) payload.body = sanitizeAuditText(payload.body, 2000);
    if (Object.prototype.hasOwnProperty.call(payload, 'starts_at')) payload.starts_at = safeIsoDate(payload.starts_at);
    if (Object.prototype.hasOwnProperty.call(payload, 'ends_at')) payload.ends_at = safeIsoDate(payload.ends_at);

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.announcement.updated', { announcement_id: data.id, changes: payload });
    res.json({ success: true, announcement: data });
  } catch (error) {
    console.error('[ADMIN] Failed to update announcement:', error.message);
    res.status(500).json({ error: 'Failed to update announcement.' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('announcements').delete().eq('id', req.params.id);
    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.announcement.deleted', { announcement_id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete announcement:', error.message);
    res.status(500).json({ error: 'Failed to delete announcement.' });
  }
});

async function deactivatePromptTemplates(templateKey, exceptId = null) {
  let query = supabaseAdmin
    .from('prompt_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('template_key', templateKey);
  if (exceptId) query = query.neq('id', exceptId);
  const { error } = await query;
  if (error) throw error;
}

router.get('/ai-controls', async (req, res) => {
  try {
    const eventPage = parsePositiveInt(req.query.eventPage, 1, 200);
    const eventPageSize = parsePositiveInt(req.query.eventPageSize, 10, 50);
    const eventFrom = (eventPage - 1) * eventPageSize;
    const eventTo = eventFrom + eventPageSize - 1;

    const [templatesResult, settingsResult, overridesResult, eventsResult] = await Promise.all([
      supabaseAdmin.from('prompt_templates').select('*').order('updated_at', { ascending: false }),
      supabaseAdmin.from('ai_rate_limit_settings').select('*').eq('id', 'global').maybeSingle(),
      supabaseAdmin.from('ai_rate_limit_overrides').select('user_id, daily_limit, is_enabled, updated_at').order('updated_at', { ascending: false }).limit(50),
      supabaseAdmin
        .from('ai_request_events')
        .select('id, user_id, feature, status, provider, metadata, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(eventFrom, eventTo),
    ]);

    const optionalError = [templatesResult.error, settingsResult.error, overridesResult.error, eventsResult.error].find(Boolean);
    if (optionalError) throw optionalError;

    const userIds = [...new Set([
      ...(overridesResult.data || []).map((row) => row.user_id),
      ...(eventsResult.data || []).map((row) => row.user_id),
    ].filter(Boolean))];
    const profilesMap = await fetchProfilesMap(userIds);

    const hydrateUser = (row) => {
      const profile = profilesMap.get(row.user_id) || {};
      return {
        ...row,
        user_name: sanitizeAuditText(profile.full_name || profile.username || profile.email || 'Unknown user', 140),
        email: sanitizeAuditText(profile.email || '', 180),
      };
    };

    res.json({
      provider_health: providerHealth(),
      rate_limit: settingsResult.data || { id: 'global', daily_limit: 10, window_hours: 24 },
      overrides: (overridesResult.data || []).map(hydrateUser),
      prompt_templates: (templatesResult.data || []).map(normalizePromptTemplate),
      recent_events: (eventsResult.data || []).map(hydrateUser),
      recent_events_pagination: buildPagination(eventPage, eventPageSize, eventsResult.count || (eventsResult.data || []).length),
    });
  } catch (error) {
    if (relationMissing(error)) {
      const eventPage = parsePositiveInt(req.query.eventPage, 1, 200);
      const eventPageSize = parsePositiveInt(req.query.eventPageSize, 10, 50);
      return res.json({
        provider_health: providerHealth(),
        rate_limit: { id: 'global', daily_limit: 10, window_hours: 24 },
        overrides: [],
        prompt_templates: [],
        recent_events: [],
        recent_events_pagination: buildPagination(eventPage, eventPageSize, 0),
      });
    }
    console.error('[ADMIN] Failed to load AI controls:', error.message);
    res.status(500).json({ error: 'Failed to load AI controls.' });
  }
});

router.patch('/ai-controls/rate-limit', async (req, res) => {
  try {
    const parsed = rateLimitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid rate limit.' });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_rate_limit_settings')
      .upsert({
        id: 'global',
        daily_limit: parsed.data.daily_limit,
        window_hours: parsed.data.window_hours,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.ai_rate_limit.updated', parsed.data);
    res.json({ success: true, rate_limit: data });
  } catch (error) {
    console.error('[ADMIN] Failed to update AI rate limit:', error.message);
    res.status(500).json({ error: 'Failed to update AI rate limit.' });
  }
});

router.put('/ai-controls/rate-limit-overrides', async (req, res) => {
  try {
    const parsed = rateLimitOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid rate limit override.' });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_rate_limit_overrides')
      .upsert({
        ...parsed.data,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.ai_rate_limit_override.updated', { target_user_id: parsed.data.user_id });
    res.json({ success: true, override: data });
  } catch (error) {
    console.error('[ADMIN] Failed to update AI rate limit override:', error.message);
    res.status(500).json({ error: 'Failed to update user rate limit.' });
  }
});

router.delete('/ai-controls/rate-limit-overrides/:userId', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('ai_rate_limit_overrides').delete().eq('user_id', req.params.userId);
    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.ai_rate_limit_override.deleted', { target_user_id: req.params.userId });
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete AI rate limit override:', error.message);
    res.status(500).json({ error: 'Failed to remove user rate limit.' });
  }
});

router.post('/ai-controls/prompt-templates', async (req, res) => {
  try {
    const parsed = promptTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid prompt template.' });
    }

    if (parsed.data.is_active) await deactivatePromptTemplates(parsed.data.template_key);

    const { data, error } = await supabaseAdmin
      .from('prompt_templates')
      .insert({
        ...parsed.data,
        title: sanitizeAuditText(parsed.data.title, 140),
        description: sanitizeAuditText(parsed.data.description || '', 400) || null,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select('*')
      .single();

    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.prompt_template.created', { template_id: data.id, template_key: data.template_key });
    res.status(201).json({ success: true, template: normalizePromptTemplate(data) });
  } catch (error) {
    console.error('[ADMIN] Failed to create prompt template:', error.message);
    res.status(500).json({ error: 'Failed to create prompt template.' });
  }
});

router.patch('/ai-controls/prompt-templates/:id', async (req, res) => {
  try {
    const parsed = updatePromptTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid prompt template update.' });
    }

    const { data: current, error: loadError } = await supabaseAdmin
      .from('prompt_templates')
      .select('id, template_key')
      .eq('id', req.params.id)
      .single();
    if (loadError) throw loadError;

    const nextKey = parsed.data.template_key || current.template_key;
    if (parsed.data.is_active) await deactivatePromptTemplates(nextKey, current.id);

    const payload = {
      ...parsed.data,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    };
    if (payload.title) payload.title = sanitizeAuditText(payload.title, 140);
    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      payload.description = sanitizeAuditText(payload.description || '', 400) || null;
    }

    const { data, error } = await supabaseAdmin
      .from('prompt_templates')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.prompt_template.updated', { template_id: data.id, template_key: data.template_key });
    res.json({ success: true, template: normalizePromptTemplate(data) });
  } catch (error) {
    console.error('[ADMIN] Failed to update prompt template:', error.message);
    res.status(500).json({ error: 'Failed to update prompt template.' });
  }
});

router.delete('/ai-controls/prompt-templates/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('prompt_templates').delete().eq('id', req.params.id);
    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.prompt_template.deleted', { template_id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete prompt template:', error.message);
    res.status(500).json({ error: 'Failed to delete prompt template.' });
  }
});

router.get('/health', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const logPage = parsePositiveInt(req.query.logPage, 1, 200);
    const logPageSize = parsePositiveInt(req.query.logPageSize, 8, 50);
    const logFrom = (logPage - 1) * logPageSize;
    const logTo = logFrom + logPageSize - 1;

    const [eventsResult, logsResult, logMetricsResult] = await Promise.all([
      supabaseAdmin
        .from('ai_request_events')
        .select('id, user_id, feature, status, provider, metadata, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('system_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(logFrom, logTo),
      supabaseAdmin
        .from('system_logs')
        .select('id, level')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (logsResult.error) throw logsResult.error;
    if (logMetricsResult.error) throw logMetricsResult.error;

    const events = eventsResult.data || [];
    const logs = logsResult.data || [];
    const logMetricsRows = logMetricsResult.data || [];
    res.json({
      provider_health: providerHealth(),
      metrics: {
        ai_requests_24h: events.length,
        ai_failed_24h: events.filter((event) => event.status === 'failed').length,
        ai_cancelled_24h: events.filter((event) => event.status === 'cancelled').length,
        error_logs: logMetricsRows.filter((log) => log.level === 'error').length,
        warning_logs: logMetricsRows.filter((log) => log.level === 'warning').length,
      },
      recent_ai_events: events,
      logs: {
        items: logs,
        pagination: buildPagination(logPage, logPageSize, logsResult.count || logs.length),
      },
    });
  } catch (error) {
    if (relationMissing(error)) {
      return res.json({
        provider_health: providerHealth(),
        metrics: { ai_requests_24h: 0, ai_failed_24h: 0, ai_cancelled_24h: 0, error_logs: 0, warning_logs: 0 },
        recent_ai_events: [],
        logs: { items: [], pagination: buildPagination(1, 8, 0) },
      });
    }
    console.error('[ADMIN] Failed to load health:', error.message);
    res.status(500).json({ error: 'Failed to load system health.' });
  }
});

router.delete('/health/logs/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('system_logs').delete().eq('id', req.params.id);
    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.system_log.deleted', { log_id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete system log:', error.message);
    res.status(500).json({ error: 'Failed to delete log.' });
  }
});

router.delete('/health/logs', async (req, res) => {
  try {
    const olderThanDays = Math.max(1, Math.min(Number(req.query.older_than_days || 30), 365));
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from('system_logs').delete().lt('created_at', cutoff);
    if (error) throw error;
    await logAuditEvent(req.user.id, 'admin.system_logs.cleared', { older_than_days: olderThanDays });
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to clear system logs:', error.message);
    res.status(500).json({ error: 'Failed to clear old logs.' });
  }
});

module.exports = router;
