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
    front: z.string().trim().min(1).max(500),
    back: z.string().trim().min(1).max(1000),
    hint: z.string().trim().max(180).optional().nullable(),
  })).min(1).max(80),
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createFlashcardSetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid flashcard set payload.' });
  }

  const title = sanitizePlainText(parsed.data.title, 180);
  const cards = parsed.data.cards
    .map((card) => ({
      front: sanitizePlainText(card.front, 500),
      back: sanitizePlainText(card.back, 1000),
      hint: sanitizePlainText(card.hint || '', 180) || null,
    }))
    .filter((card) => card.front && card.back);

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

module.exports = router;
