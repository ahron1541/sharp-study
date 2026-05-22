const express = require('express');
const { z } = require('zod');

const { supabaseAdmin } = require('../../config/supabase');
const { requireAuth } = require('../../middleware/auth.middleware');
const { invalidateDashboardCache } = require('../dashboard/dashboard.cache');
const { sanitizePlainText, sanitizeStudyGuideContent } = require('../../utils/studyGuideSanitize');
const { ACTIVITY_TYPES, recordStudyActivity } = require('../streaks/streaks.service');

const router = express.Router();

const createStudyGuideSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1),
});

const updateStudyGuideSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required.',
});

router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const parsed = createStudyGuideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid study guide payload.' });
    }

    const { title, content } = parsed.data;
    const cleanTitle = sanitizePlainText(title).slice(0, 200);
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Study guide title is required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('study_guides')
      .insert({
        user_id: req.user.id,
        title: cleanTitle,
        content: sanitizeStudyGuideContent(content),
        document_id: null,
        is_archived: false,
      })
      .select('id, title, content, created_at')
      .single();

    if (error) throw error;

    invalidateDashboardCache(req.user.id);
    await recordStudyActivity(req.user.id, ACTIVITY_TYPES.STUDY_GUIDE_CREATED);
    return res.status(201).json({ success: true, item: data });
  } catch (error) {
    console.error('[STUDY_GUIDES] Failed to create study guide:', error.message);
    return res.status(500).json({ error: 'Failed to create study guide.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const parsed = updateStudyGuideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid study guide update.' });
    }

    const payload = { ...parsed.data };
    if (payload.title) {
      payload.title = sanitizePlainText(payload.title).slice(0, 200);
      if (!payload.title) {
        return res.status(400).json({ error: 'Study guide title is required.' });
      }
    }

    if (payload.content) {
      payload.content = sanitizeStudyGuideContent(payload.content);
    }

    const { data, error } = await supabaseAdmin
      .from('study_guides')
      .update(payload)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, title, content, created_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Study guide not found.' });
    }

    if (payload.title) {
      invalidateDashboardCache(req.user.id);
    }

    await recordStudyActivity(req.user.id, ACTIVITY_TYPES.STUDY_GUIDE_UPDATED);
    return res.json({ success: true, item: data });
  } catch (error) {
    console.error('[STUDY_GUIDES] Failed to update study guide:', error.message);
    return res.status(500).json({ error: 'Failed to update study guide.' });
  }
});

module.exports = router;
