const express = require('express');
const { z } = require('zod');

const { supabaseAdmin } = require('../../config/supabase');
const { requireAuth } = require('../../middleware/auth.middleware');
const { sanitizePlainText } = require('../../utils/studyGuideSanitize');
const { writeSystemLog } = require('../../utils/systemLog');

const router = express.Router();

const CONTENT_CONFIG = {
  study_guide: { table: 'study_guides', label: 'Study guide' },
  flashcards: { table: 'flashcard_sets', label: 'Flashcards' },
  quiz: { table: 'quizzes', label: 'Quiz' },
};

const contentTypeSchema = z.enum(['study_guide', 'flashcards', 'quiz']);
const reportReasonSchema = z.enum(['incorrect', 'confusing', 'incomplete', 'formatting', 'inappropriate', 'other']);
const reactionSchema = z.object({
  content_type: contentTypeSchema,
  content_id: z.string().uuid(),
  reaction: z.enum(['up', 'down']).nullable(),
});
const reportSchema = z.object({
  content_type: contentTypeSchema,
  content_id: z.string().uuid(),
  reason: reportReasonSchema,
  details: z.string().max(800).optional().default(''),
});

router.use(requireAuth);

async function resolveOwnedContent(contentType, contentId, userId) {
  const config = CONTENT_CONFIG[contentType];
  if (!config) return null;

  const { data, error } = await supabaseAdmin
    .from(config.table)
    .select('id, user_id, title, is_archived')
    .eq('id', contentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.is_archived) return null;
  return data;
}

router.get('/content/:type/:id', async (req, res) => {
  try {
    const contentType = String(req.params.type || '').trim();
    const contentId = String(req.params.id || '').trim();
    const parsedType = contentTypeSchema.safeParse(contentType);
    if (!parsedType.success || !z.string().uuid().safeParse(contentId).success) {
      return res.status(400).json({ error: 'Invalid feedback target.' });
    }

    const content = await resolveOwnedContent(contentType, contentId, req.user.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found.' });
    }

    const [reactionResult, latestReportResult, countsResult] = await Promise.all([
      supabaseAdmin
        .from('ai_content_reactions')
        .select('reaction')
        .eq('user_id', req.user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .maybeSingle(),
      supabaseAdmin
        .from('ai_content_reports')
        .select('id, reason, status, created_at')
        .eq('user_id', req.user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('ai_content_reactions')
        .select('reaction')
        .eq('content_type', contentType)
        .eq('content_id', contentId),
    ]);

    const missingTableError = [reactionResult.error, latestReportResult.error, countsResult.error]
      .find((error) => error?.code === '42P01');
    if (missingTableError) {
      return res.json({ reaction: null, latest_report: null, counts: { up: 0, down: 0 } });
    }

    if (reactionResult.error) throw reactionResult.error;
    if (latestReportResult.error) throw latestReportResult.error;
    if (countsResult.error) throw countsResult.error;

    const reactions = countsResult.data || [];
    return res.json({
      reaction: reactionResult.data?.reaction || null,
      latest_report: latestReportResult.data || null,
      counts: {
        up: reactions.filter((item) => item.reaction === 'up').length,
        down: reactions.filter((item) => item.reaction === 'down').length,
      },
    });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'feedback',
      message: 'Failed to load content feedback status.',
      metadata: { user_id: req.user.id, error: error.message },
    });
    return res.status(500).json({ error: 'Failed to load feedback.' });
  }
});

router.put('/reaction', async (req, res) => {
  try {
    const parsed = reactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reaction.' });
    }

    const { content_type: contentType, content_id: contentId, reaction } = parsed.data;
    const content = await resolveOwnedContent(contentType, contentId, req.user.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found.' });
    }

    if (!reaction) {
      const { error } = await supabaseAdmin
        .from('ai_content_reactions')
        .delete()
        .eq('user_id', req.user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId);
      if (error) throw error;
      return res.json({ success: true, reaction: null });
    }

    const { error } = await supabaseAdmin
      .from('ai_content_reactions')
      .upsert({
        user_id: req.user.id,
        content_type: contentType,
        content_id: contentId,
        reaction,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,content_type,content_id' });

    if (error) throw error;
    return res.json({ success: true, reaction });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'feedback',
      message: 'Failed to save AI content reaction.',
      metadata: { user_id: req.user.id, error: error.message },
    });
    return res.status(500).json({ error: 'Failed to save reaction.' });
  }
});

router.post('/reports', async (req, res) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report.' });
    }

    const { content_type: contentType, content_id: contentId, reason } = parsed.data;
    const content = await resolveOwnedContent(contentType, contentId, req.user.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found.' });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_content_reports')
      .insert({
        user_id: req.user.id,
        content_owner_id: content.user_id,
        content_type: contentType,
        content_id: contentId,
        content_title: sanitizePlainText(content.title || CONTENT_CONFIG[contentType].label).slice(0, 220),
        reason,
        details: sanitizePlainText(parsed.data.details || '', 800) || null,
      })
      .select('id, reason, status, created_at')
      .single();

    if (error) throw error;
    return res.status(201).json({ success: true, report: data });
  } catch (error) {
    await writeSystemLog({
      level: 'error',
      source: 'feedback',
      message: 'Failed to submit AI content report.',
      metadata: { user_id: req.user.id, error: error.message },
    });
    return res.status(500).json({ error: 'Failed to send report.' });
  }
});

module.exports = router;
