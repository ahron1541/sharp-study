const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../../middleware/auth.middleware');
const { supabaseAdmin } = require('../../config/supabase');
const { awardFlashcardReviewXp } = require('../gamification/gamification.service');
const { ACTIVITY_TYPES, recordStudyActivity } = require('../streaks/streaks.service');

const router = express.Router();

function sanitizePlainText(value = '', maxLength = 1000) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const difficultySchema = z.enum(['easy', 'normal', 'hard', 'expert']);

const createFlashcardSetSchema = z.object({
  title: z.string().trim().min(1).max(180),
  cards: z.array(z.object({
    id: z.string().uuid().optional(),
    front: z.string().trim().min(1).max(500),
    back: z.string().trim().min(1).max(1000),
    hint: z.string().trim().max(180).optional().nullable(),
  })).min(1).max(80),
});

const flashcardAttemptSchema = z.object({
  card_id: z.string().regex(UUID_PATTERN),
  result: z.enum(['known', 'learning']),
  response_ms: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional().nullable(),
  difficulty: difficultySchema.default('normal'),
});

const flashcardProgressSchema = z.object({
  current_index: z.number().int().min(0).optional(),
  order_json: z.array(z.string().regex(UUID_PATTERN)).optional(),
  statuses_json: z.record(z.string().regex(UUID_PATTERN), z.enum(['known', 'learning'])).optional(),
});

router.use(requireAuth);

function normalizeCardPayload(cards = []) {
  return cards
    .map((card) => ({
      id: card.id || null,
      front: sanitizePlainText(card.front, 500),
      back: sanitizePlainText(card.back, 1000),
      hint: sanitizePlainText(card.hint || '', 180) || null,
    }))
    .filter((card) => card.front && card.back);
}

async function getOwnedSet(setId, userId) {
  const { data, error } = await supabaseAdmin
    .from('flashcard_sets')
    .select('id, user_id, document_id, source_study_guide_id, title, difficulty, is_archived, created_at')
    .eq('id', setId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function normalizeCardRow(card) {
  return {
    id: card.id,
    set_id: card.set_id,
    front: sanitizePlainText(card.front, 500),
    back: sanitizePlainText(card.back, 1000),
    hint: sanitizePlainText(card.hint || '', 180),
    difficulty: card.difficulty || 'normal',
    created_at: card.created_at,
  };
}

function normalizeProgressRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    current_index: Number(row.current_index) || 0,
    order_json: Array.isArray(row.order_json) ? row.order_json : [],
    statuses_json: row.statuses_json && typeof row.statuses_json === 'object' ? row.statuses_json : {},
    known_count: Number(row.known_count) || 0,
    learning_count: Number(row.learning_count) || 0,
    updated_at: row.updated_at,
  };
}

function countProgressStatuses(statuses = {}) {
  const values = Object.values(statuses || {});
  return {
    known: values.filter((status) => status === 'known').length,
    learning: values.filter((status) => status === 'learning').length,
  };
}

function normalizeProgressPayload(progress, cards = []) {
  const validIds = new Set(cards.map((card) => card.id));
  const order = Array.isArray(progress.order_json)
    ? progress.order_json.filter((cardId) => validIds.has(cardId))
    : [];
  const statuses = progress.statuses_json && typeof progress.statuses_json === 'object'
    ? Object.fromEntries(
      Object.entries(progress.statuses_json)
        .filter(([cardId, status]) => validIds.has(cardId) && ['known', 'learning'].includes(status))
    )
    : {};
  const counts = countProgressStatuses(statuses);
  const currentIndex = order.length
    ? Math.max(0, Math.min(Number(progress.current_index) || 0, order.length - 1))
    : 0;

  return {
    current_index: currentIndex,
    order_json: order,
    statuses_json: statuses,
    known_count: counts.known,
    learning_count: counts.learning,
    updated_at: new Date().toISOString(),
  };
}

async function getSetCards(setId) {
  const { data, error } = await supabaseAdmin
    .from('flashcards')
    .select('id, set_id, front, back, hint, difficulty, created_at')
    .eq('set_id', setId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getRelatedMaterialIds(set, userId) {
  if (!set?.document_id) {
    return { relatedStudyGuideId: '', relatedQuizId: '' };
  }

  const [{ data: guideData, error: guideError }, { data: quizData, error: quizError }] = await Promise.all([
    supabaseAdmin
      .from('study_guides')
      .select('id')
      .eq('document_id', set.document_id)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('quizzes')
      .select('id')
      .eq('document_id', set.document_id)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .limit(1)
      .maybeSingle(),
  ]);

  if (guideError) throw guideError;
  if (quizError) throw quizError;

  return {
    relatedStudyGuideId: guideData?.id || '',
    relatedQuizId: quizData?.id || '',
  };
}

async function cleanupDeletedCardReferences(setId, userId, cardIds = []) {
  const ids = cardIds.filter((cardId) => UUID_PATTERN.test(cardId));
  if (!ids.length) return;

  const { error: attemptsError } = await supabaseAdmin
    .from('flashcard_attempts')
    .delete()
    .eq('set_id', setId)
    .in('card_id', ids);

  if (attemptsError) throw attemptsError;

  const { data: progressRows, error: progressError } = await supabaseAdmin
    .from('flashcard_progress')
    .select('id, current_index, order_json, statuses_json')
    .eq('set_id', setId)
    .eq('user_id', userId);

  if (progressError) throw progressError;

  const deletedIds = new Set(ids);
  for (const row of progressRows || []) {
    const order = Array.isArray(row.order_json)
      ? row.order_json.filter((cardId) => !deletedIds.has(cardId))
      : [];
    const statuses = row.statuses_json && typeof row.statuses_json === 'object'
      ? { ...row.statuses_json }
      : {};

    for (const cardId of ids) {
      delete statuses[cardId];
    }

    const counts = countProgressStatuses(statuses);
    const nextIndex = order.length
      ? Math.max(0, Math.min(Number(row.current_index) || 0, order.length - 1))
      : 0;

    const { error: updateError } = await supabaseAdmin
      .from('flashcard_progress')
      .update({
        current_index: nextIndex,
        order_json: order,
        statuses_json: statuses,
        known_count: counts.known,
        learning_count: counts.learning,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('user_id', userId);

    if (updateError) throw updateError;
  }
}

router.post('/', async (req, res) => {
  const parsed = createFlashcardSetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid flashcard set payload.' });
  }

  const title = sanitizePlainText(parsed.data.title, 180);
  const cards = normalizeCardPayload(parsed.data.cards);

  if (!title || !cards.length) {
    return res.status(400).json({ error: 'A title and at least one complete flashcard are required.' });
  }

  let createdSet = null;

  try {
    const { data: set, error: setError } = await supabaseAdmin
      .from('flashcard_sets')
      .insert({
        user_id: req.user.id,
        title,
        document_id: null,
        is_archived: false,
      })
      .select('id, user_id, document_id, source_study_guide_id, title, difficulty, is_archived, created_at')
      .single();

    if (setError) throw setError;
    createdSet = set;

    const { data: createdCards, error: cardsError } = await supabaseAdmin
      .from('flashcards')
      .insert(
        cards.map((card) => ({
          set_id: set.id,
          front: card.front,
          back: card.back,
          hint: card.hint,
        }))
      )
      .select('id, set_id, front, back, hint, difficulty, created_at');

    if (cardsError) throw cardsError;

    await recordStudyActivity(req.user.id, ACTIVITY_TYPES.FLASHCARD_CREATED);

    return res.status(201).json({
      success: true,
      item: { id: set.id, title: sanitizePlainText(set.title, 180) },
      set: {
        id: set.id,
        title: sanitizePlainText(set.title, 180),
        document_id: set.document_id,
        source_study_guide_id: set.source_study_guide_id,
        difficulty: set.difficulty || 'normal',
        created_at: set.created_at,
      },
      cards: (createdCards || []).map(normalizeCardRow),
      relatedStudyGuideId: '',
      relatedQuizId: '',
    });
  } catch (error) {
    if (createdSet?.id) {
      await supabaseAdmin.from('flashcard_sets').delete().eq('id', createdSet.id);
    }

    console.error('[FLASHCARDS] Failed to create flashcard set:', error.message);
    return res.status(500).json({ error: 'Failed to create flashcard set.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const setId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(setId)) {
      return res.status(400).json({ error: 'Invalid flashcard set id.' });
    }

    const set = await getOwnedSet(setId, req.user.id);
    if (!set || set.is_archived) {
      return res.status(404).json({ error: 'Flashcard set not found.' });
    }

    const [cards, related] = await Promise.all([
      getSetCards(set.id),
      getRelatedMaterialIds(set, req.user.id),
    ]);

    return res.json({
      success: true,
      set: {
        id: set.id,
        title: sanitizePlainText(set.title, 180),
        document_id: set.document_id,
        source_study_guide_id: set.source_study_guide_id,
        difficulty: set.difficulty || 'normal',
        created_at: set.created_at,
      },
      cards: (cards || []).map(normalizeCardRow),
      relatedStudyGuideId: related.relatedStudyGuideId,
      relatedQuizId: related.relatedQuizId,
    });
  } catch (error) {
    console.error('[FLASHCARDS] Failed to load flashcard set:', error.message);
    return res.status(500).json({ error: 'Failed to load flashcard set.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const setId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(setId)) {
      return res.status(400).json({ error: 'Invalid flashcard set id.' });
    }

    const parsed = createFlashcardSetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid flashcard set payload.' });
    }

    const set = await getOwnedSet(setId, req.user.id);
    if (!set || set.is_archived) {
      return res.status(404).json({ error: 'Flashcard set not found.' });
    }

    const title = sanitizePlainText(parsed.data.title, 180);
    const cards = normalizeCardPayload(parsed.data.cards);
    if (!title || !cards.length) {
      return res.status(400).json({ error: 'A title and at least one complete flashcard are required.' });
    }

    const { data: existingCards, error: existingError } = await supabaseAdmin
      .from('flashcards')
      .select('id')
      .eq('set_id', set.id);

    if (existingError) throw existingError;

    const existingIds = new Set((existingCards || []).map((card) => card.id));
    const incomingIds = new Set(cards.map((card) => card.id).filter(Boolean));
    const invalidCard = [...incomingIds].find((cardId) => !existingIds.has(cardId));
    if (invalidCard) {
      return res.status(400).json({ error: 'One or more cards do not belong to this set.' });
    }

    const { error: setError } = await supabaseAdmin
      .from('flashcard_sets')
      .update({ title })
      .eq('id', set.id)
      .eq('user_id', req.user.id);

    if (setError) throw setError;

    const idsToDelete = [...existingIds].filter((cardId) => !incomingIds.has(cardId));
    if (idsToDelete.length) {
      await cleanupDeletedCardReferences(set.id, req.user.id, idsToDelete);

      const { error: deleteError } = await supabaseAdmin
        .from('flashcards')
        .delete()
        .eq('set_id', set.id)
        .in('id', idsToDelete);
      if (deleteError) throw deleteError;
    }

    for (const card of cards) {
      if (card.id) {
        const { error: updateError } = await supabaseAdmin
          .from('flashcards')
          .update({
            front: card.front,
            back: card.back,
            hint: card.hint,
          })
          .eq('set_id', set.id)
          .eq('id', card.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('flashcards')
          .insert({
            set_id: set.id,
            front: card.front,
            back: card.back,
            hint: card.hint,
          });
        if (insertError) throw insertError;
      }
    }

    const [
      { data: updatedSet, error: updatedSetError },
      { data: updatedCards, error: updatedCardsError },
      related,
    ] = await Promise.all([
      supabaseAdmin
        .from('flashcard_sets')
        .select('id, user_id, document_id, source_study_guide_id, title, difficulty, is_archived, created_at')
        .eq('id', set.id)
        .eq('user_id', req.user.id)
        .single(),
      supabaseAdmin
        .from('flashcards')
        .select('id, set_id, front, back, hint, difficulty, created_at')
        .eq('set_id', set.id)
        .order('created_at', { ascending: true }),
      getRelatedMaterialIds(set, req.user.id),
    ]);

    if (updatedSetError) throw updatedSetError;
    if (updatedCardsError) throw updatedCardsError;

    await recordStudyActivity(req.user.id, ACTIVITY_TYPES.FLASHCARD_UPDATED);

    return res.json({
      success: true,
      set: {
        id: updatedSet.id,
        title: sanitizePlainText(updatedSet.title, 180),
        document_id: updatedSet.document_id,
        source_study_guide_id: updatedSet.source_study_guide_id,
        difficulty: updatedSet.difficulty || 'normal',
        created_at: updatedSet.created_at,
      },
      cards: (updatedCards || []).map(normalizeCardRow),
      relatedStudyGuideId: related.relatedStudyGuideId,
      relatedQuizId: related.relatedQuizId,
    });
  } catch (error) {
    console.error('[FLASHCARDS] Failed to update flashcard set:', error.message);
    return res.status(500).json({ error: 'Failed to update flashcard set.' });
  }
});

router.get('/:id/progress', async (req, res) => {
  try {
    const setId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(setId)) {
      return res.status(400).json({ error: 'Invalid flashcard set id.' });
    }

    const set = await getOwnedSet(setId, req.user.id);
    if (!set || set.is_archived) {
      return res.status(404).json({ error: 'Flashcard set not found.' });
    }

    const { data: progress, error: progressError } = await supabaseAdmin
      .from('flashcard_progress')
      .select('id, current_index, order_json, statuses_json, known_count, learning_count, updated_at')
      .eq('user_id', req.user.id)
      .eq('set_id', set.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (progressError) throw progressError;
    return res.json({ success: true, progress: normalizeProgressRow(progress) });
  } catch (error) {
    console.error('[FLASHCARDS] Failed to load flashcard progress:', error.message);
    return res.status(500).json({ error: 'Failed to load flashcard progress.' });
  }
});

router.put('/:id/progress', async (req, res) => {
  try {
    const setId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(setId)) {
      return res.status(400).json({ error: 'Invalid flashcard set id.' });
    }

    const parsed = flashcardProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid flashcard progress payload.' });
    }

    const set = await getOwnedSet(setId, req.user.id);
    if (!set || set.is_archived) {
      return res.status(404).json({ error: 'Flashcard set not found.' });
    }

    const cards = await getSetCards(set.id);
    const progressPayload = normalizeProgressPayload(parsed.data, cards);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('flashcard_progress')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('set_id', set.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('flashcard_progress')
        .update(progressPayload)
        .eq('id', existing.id)
        .eq('user_id', req.user.id)
        .select('id, current_index, order_json, statuses_json, known_count, learning_count, updated_at')
        .single();

      if (updateError) throw updateError;
      return res.json({ success: true, progress: normalizeProgressRow(updated) });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('flashcard_progress')
      .insert({
        user_id: req.user.id,
        set_id: set.id,
        ...progressPayload,
      })
      .select('id, current_index, order_json, statuses_json, known_count, learning_count, updated_at')
      .single();

    if (insertError) throw insertError;
    return res.json({ success: true, progress: normalizeProgressRow(inserted) });
  } catch (error) {
    console.error('[FLASHCARDS] Failed to save flashcard progress:', error.message);
    return res.status(500).json({ error: 'Failed to save flashcard progress.' });
  }
});

router.post('/:id/attempts', async (req, res) => {
  try {
    const setId = String(req.params.id || '').trim();
    if (!UUID_PATTERN.test(setId)) {
      return res.status(400).json({ error: 'Invalid flashcard set id.' });
    }

    const parsed = flashcardAttemptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid flashcard attempt payload.' });
    }

    const set = await getOwnedSet(setId, req.user.id);
    if (!set || set.is_archived) {
      return res.status(404).json({ error: 'Flashcard set not found.' });
    }

    const { data: card, error: cardError } = await supabaseAdmin
      .from('flashcards')
      .select('id')
      .eq('set_id', set.id)
      .eq('id', parsed.data.card_id)
      .maybeSingle();

    if (cardError) throw cardError;
    if (!card) {
      return res.status(404).json({ error: 'Flashcard not found.' });
    }

    const { data: attempt, error: insertError } = await supabaseAdmin
      .from('flashcard_attempts')
      .insert({
        user_id: req.user.id,
        set_id: set.id,
        card_id: card.id,
        result: parsed.data.result,
        response_ms: parsed.data.response_ms ?? null,
        difficulty: parsed.data.difficulty,
      })
      .select('id, created_at')
      .single();

    if (insertError) throw insertError;
    await recordStudyActivity(req.user.id, ACTIVITY_TYPES.FLASHCARD_REVIEW, {
      sourceType: 'flashcards',
      sourceId: set.id,
      metadata: {
        set_id: set.id,
        card_id: card.id,
        result: parsed.data.result,
        difficulty: parsed.data.difficulty,
      },
    });
    await awardFlashcardReviewXp(req.user.id, {
      id: attempt.id,
      set_id: set.id,
      card_id: card.id,
      result: parsed.data.result,
      response_ms: parsed.data.response_ms ?? null,
      difficulty: parsed.data.difficulty,
    });

    return res.status(201).json({
      success: true,
      attempt: {
        id: attempt.id,
        created_at: attempt.created_at,
        difficulty: parsed.data.difficulty,
      },
    });
  } catch (error) {
    console.error('[FLASHCARDS] Failed to save flashcard attempt:', error.message);
    return res.status(500).json({ error: 'Failed to save flashcard attempt.' });
  }
});

router.delete('/:id/cards/:cardId', async (req, res) => {
  try {
    const setId = String(req.params.id || '').trim();
    const cardId = String(req.params.cardId || '').trim();
    if (!UUID_PATTERN.test(setId) || !UUID_PATTERN.test(cardId)) {
      return res.status(400).json({ error: 'Invalid flashcard id.' });
    }

    const set = await getOwnedSet(setId, req.user.id);
    if (!set || set.is_archived) {
      return res.status(404).json({ error: 'Flashcard set not found.' });
    }

    const { data: card, error: cardError } = await supabaseAdmin
      .from('flashcards')
      .select('id')
      .eq('set_id', set.id)
      .eq('id', cardId)
      .maybeSingle();

    if (cardError) throw cardError;
    if (!card) {
      return res.status(404).json({ error: 'Flashcard not found.' });
    }

    await cleanupDeletedCardReferences(set.id, req.user.id, [cardId]);

    const { error: deleteError } = await supabaseAdmin
      .from('flashcards')
      .delete()
      .eq('set_id', set.id)
      .eq('id', cardId);

    if (deleteError) throw deleteError;

    return res.json({ success: true });
  } catch (error) {
    console.error('[FLASHCARDS] Failed to delete flashcard:', error.message);
    return res.status(500).json({ error: 'Failed to delete flashcard.' });
  }
});

module.exports = router;
