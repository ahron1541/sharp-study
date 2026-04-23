const express = require('express');
const { generateMaterials } = require('./ai.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { aiLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

// POST /api/ai/generate
// Auth required + AI rate limit (10/hour)
router.post('/generate', requireAuth, aiLimiter, ...generateMaterials);

module.exports = router;