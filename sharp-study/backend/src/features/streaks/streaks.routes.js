const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { getStudyStreak } = require('./streaks.service');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const streak = await getStudyStreak(req.user.id, { days: req.query.days });
    return res.json({ success: true, streak });
  } catch (error) {
    console.error('[STREAKS] Failed to load streak:', error.message);
    return res.status(500).json({ error: 'Failed to load study streak.' });
  }
});

module.exports = router;
