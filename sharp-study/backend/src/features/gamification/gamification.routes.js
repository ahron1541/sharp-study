const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { getStudyStreak } = require('../streaks/streaks.service');
const { getGamificationSummary } = require('./gamification.service');

const router = express.Router();

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const streak = await getStudyStreak(req.user.id, { days: req.query.days || 35 });
    const gamification = await getGamificationSummary(req.user.id, streak);
    return res.json({ success: true, gamification });
  } catch (error) {
    console.error('[ACHIEVEMENTS] Failed to load summary:', error.message);
    return res.status(500).json({ error: 'Failed to load achievements.' });
  }
});

module.exports = router;
