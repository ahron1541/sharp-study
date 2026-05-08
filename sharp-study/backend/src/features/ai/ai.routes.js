const express = require('express');
const { cancelGeneration, generateFlashcardsFromStudyGuide, generateMaterials, getGenerationStatus } = require('./ai.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { aiLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

// POST /api/ai/generate
// Auth required + AI rate limit (10/hour)
router.post('/generate', requireAuth, aiLimiter, ...generateMaterials);
router.post('/study-guide/:id/flashcards', requireAuth, aiLimiter, generateFlashcardsFromStudyGuide);
router.get('/generate/:jobId', requireAuth, getGenerationStatus);
router.post('/generate/:jobId/cancel', requireAuth, cancelGeneration);

module.exports = router;
