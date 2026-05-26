const express = require('express');
const {
  cancelGeneration,
  generateFlashcardsFromStudyGuide,
  generateMaterials,
  generateQuizFromStudyGuide,
  getGenerationStatus,
} = require('./ai.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { aiDailyLimit } = require('./aiUsage.service');

const router = express.Router();

// POST /api/ai/generate
// Auth required + database-backed AI daily limit
router.post('/generate', requireAuth, aiDailyLimit, ...generateMaterials);
router.post('/study-guide/:id/flashcards', requireAuth, aiDailyLimit, generateFlashcardsFromStudyGuide);
router.post('/study-guide/:id/quiz', requireAuth, aiDailyLimit, generateQuizFromStudyGuide);
router.get('/generate/:jobId', requireAuth, getGenerationStatus);
router.post('/generate/:jobId/cancel', requireAuth, cancelGeneration);

module.exports = router;
