const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../../middleware/auth.middleware');
const { supabaseAdmin } = require('../../config/supabase');

const router = express.Router();

function sanitizePlainText(value = '', maxLength = 1000) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const createFlashcardSetSchema = z.object({
  title: z.string().trim().min(1).max(180),
  cards: z.array(z.object({
    id: z.string().uuid().optional(),
    front: z.string().trim().min(1).max(500),
    back: z.string().trim().min(1).max(1000),
    hint: z.string().trim().max(180).optional().nullable(),
  })).min(1).max(80),
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

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
    .select('id, user_id, document_id, source_study_guide_id, title, is_archived, created_at')
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
    created_at: card.created_at,
  };
}

function countProgressStatuses(statuses = {}) {
  const values = Object.values(statuses || {});
  return {
    known: values.filter((status) => status === 'known').length,
    learning: values.filter((status) => status === 'learning').length,
  };
}

async function cleanupDeletedCardReferences(setId, userId, cardIds = []) {
  const ids = cardIds.filter((cardId) => UUID_PATTERN.test(cardId));
  if (!ids.length) return;

  const { error: attemptsError } = await supabaseAdmin
    .from('flashcard_attempts')
    .delete()
    .eq('set_id', setId)
    .eq('user_id', userId)
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
      .select('id, title')
      .single();

    if (setError) throw setError;
    createdSet = set;

    const { error: cardsError } = await supabaseAdmin.from('flashcards').insert(
      cards.map((card) => ({
        set_id: set.id,
        front: card.front,
        back: card.back,
        hint: card.hint,
      }))
    );

    if (cardsError) throw cardsError;

    return res.status(201).json({ success: true, item: set });
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

    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('flashcards')
      .select('id, set_id, front, back, hint, created_at')
      .eq('set_id', set.id)
      .order('created_at', { ascending: true });

    if (cardsError) throw cardsError;

    return res.json({
      success: true,
      set: {
        id: set.id,
        title: sanitizePlainText(set.title, 180),
        document_id: set.document_id,
        source_study_guide_id: set.source_study_guide_id,
        created_at: set.created_at,
      },
      cards: (cards || []).map(normalizeCardRow),
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

    const [{ data: updatedSet, error: updatedSetError }, { data: updatedCards, error: updatedCardsError }] = await Promise.all([
      supabaseAdmin
        .from('flashcard_sets')
        .select('id, user_id, document_id, source_study_guide_id, title, is_archived, created_at')
        .eq('id', set.id)
        .eq('user_id', req.user.id)
        .single(),
      supabaseAdmin
        .from('flashcards')
        .select('id, set_id, front, back, hint, created_at')
        .eq('set_id', set.id)
        .order('created_at', { ascending: true }),
    ]);

    if (updatedSetError) throw updatedSetError;
    if (updatedCardsError) throw updatedCardsError;

    return res.json({
      success: true,
      set: {
        id: updatedSet.id,
        title: sanitizePlainText(updatedSet.title, 180),
        document_id: updatedSet.document_id,
        source_study_guide_id: updatedSet.source_study_guide_id,
        created_at: updatedSet.created_at,
      },
      cards: (updatedCards || []).map(normalizeCardRow),
    });
  } catch (error) {
    console.error('[FLASHCARDS] Failed to update flashcard set:', error.message);
    return res.status(500).json({ error: 'Failed to update flashcard set.' });
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
