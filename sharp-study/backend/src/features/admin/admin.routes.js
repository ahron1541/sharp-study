const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const { requireAdmin } = require('../../middleware/auth.middleware');
const { supabaseAdmin } = require('../../config/supabase');

const router = express.Router();

const USER_PAGE_SIZE = 10;
const CONTENT_PAGE_SIZE = 10;
const CONTENT_TYPES = new Set(['documents', 'study_guides', 'flashcard_sets', 'quizzes']);
const ADMIN_PASSWORD_RULES = [
  { test: (value) => value.length >= 8, message: 'Password must be at least 8 characters long.' },
  { test: (value) => /[A-Z]/.test(value), message: 'Password must include at least one uppercase letter.' },
  { test: (value) => /[a-z]/.test(value), message: 'Password must include at least one lowercase letter.' },
  { test: (value) => /[0-9]/.test(value), message: 'Password must include at least one number.' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), message: 'Password must include at least one special character.' },
];

const createUserSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(3).max(20).regex(/^[a-z0-9_.-]+$/, 'Username can only contain lowercase letters, numbers, periods, hyphens, and underscores.'),
  first_name: z.string().trim().min(1).max(50),
  middle_name: z.string().trim().max(50).optional().default(''),
  last_name: z.string().trim().min(1).max(50),
  password: z.string().min(8).max(128),
  role: z.enum(['student', 'admin']).default('student'),
});

const updateUserSchema = z.object({
  role: z.enum(['student', 'admin']).optional(),
  is_blocked: z.boolean().optional(),
  username: z.string().trim().min(3).max(20).regex(/^[a-z0-9_.-]+$/, 'Username can only contain lowercase letters, numbers, periods, hyphens, and underscores.').optional(),
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

router.use(requireAdmin);

function parsePositiveInt(value, fallback, max = 50) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
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

async function fetchOverview() {
  const [
    profilesResult,
    documentsResult,
    studyGuidesResult,
    flashcardSetsResult,
    quizzesResult,
    auditResult,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, role, is_blocked', { count: 'exact' }),
    supabaseAdmin.from('documents').select('id, status', { count: 'exact' }),
    supabaseAdmin.from('study_guides').select('id', { count: 'exact' }),
    supabaseAdmin.from('flashcard_sets').select('id', { count: 'exact' }),
    supabaseAdmin.from('quizzes').select('id', { count: 'exact' }),
    supabaseAdmin.from('audit_logs').select('id, event, created_at, metadata, user_id').order('created_at', { ascending: false }).limit(8),
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
  const audits = auditResult.data || [];

  return {
    metrics: {
      total_users: profilesResult.count || profiles.length,
      admins: profiles.filter((profile) => profile.role === 'admin').length,
      blocked_users: profiles.filter((profile) => profile.is_blocked).length,
      active_users: profiles.filter((profile) => !profile.is_blocked).length,
      documents: documentsResult.count || documents.length,
      study_guides: studyGuidesResult.count || 0,
      flashcard_sets: flashcardSetsResult.count || 0,
      quizzes: quizzesResult.count || 0,
      documents_processing: documents.filter((doc) => doc.status === 'processing').length,
      documents_done: documents.filter((doc) => doc.status === 'done').length,
      documents_error: documents.filter((doc) => doc.status === 'error').length,
    },
    recent_activity: audits,
  };
}

router.get('/overview', async (req, res) => {
  try {
    const overview = await fetchOverview();
    res.json(overview);
  } catch (error) {
    console.error('[ADMIN] Failed to fetch overview:', error.message);
    res.status(500).json({ error: 'Failed to load admin overview.' });
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

router.delete('/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (error) throw error;

    await logAuditEvent(req.user.id, 'admin.user.deleted', {
      target_user_id: targetId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Failed to delete user:', error.message);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

async function fetchContentPage({ type, search, page, pageSize }) {
  const normalizedType = CONTENT_TYPES.has(type) ? type : 'all';
  const queries = normalizedType === 'all' ? [...CONTENT_TYPES] : [normalizedType];
  const rows = [];

  for (const queryType of queries) {
    const fields = queryType === 'documents'
      ? 'id, user_id, title, created_at, is_archived, file_type, status'
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
  const pageItems = rows.slice(from, to);
  const userIds = [...new Set(pageItems.map((item) => item.user_id).filter(Boolean))];
  const profilesMap = await fetchProfilesMap(userIds);

  return {
    items: pageItems.map((item) => ({
      ...item,
      owner: profilesMap.get(item.user_id) || null,
    })),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

router.get('/content', async (req, res) => {
  try {
    const type = String(req.query.type || 'all').trim();
    const search = normalizeSearch(req.query.search);
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, CONTENT_PAGE_SIZE, 25);
    const result = await fetchContentPage({ type, search, page, pageSize });

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

module.exports = router;
