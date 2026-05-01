const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { getDashboard } = require('./dashboard.controller');
const { invalidateDashboardCache } = require('./dashboard.cache');

const router = express.Router();

router.get('/', requireAuth, getDashboard);
router.post('/invalidate', requireAuth, (req, res) => {
  invalidateDashboardCache(req.user.id);
  res.json({ success: true });
});

module.exports = router;
