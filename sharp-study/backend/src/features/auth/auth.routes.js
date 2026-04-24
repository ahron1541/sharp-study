const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

// The 4-Step Signup Flow
router.post('/signup/request-otp', authController.requestSignupOtp);
router.post('/signup/verify-otp', authController.verifySignupOtp);
router.get('/signup/check-username', authController.checkUsername);
router.post('/signup/complete', authController.completeSignup);

// Login
router.post('/login', authController.login);

// --- FORGOT PASSWORD FLOW (NEW) ---
router.post('/forgot-password/request-otp', authController.requestPasswordReset);
router.post('/forgot-password/verify-otp', authController.verifyResetOtp);
router.post('/forgot-password/reset', authController.resetPassword);

module.exports = router;

// GET  /api/auth/preferences  — fetch current user's preferences
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../../config/supabase');
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('preferences')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json({ preferences: data.preferences ?? {} });
  } catch (err) {
    res.status(500).json({ error: 'Could not load preferences.' });
  }
});

// PATCH /api/auth/preferences  — update preferences
router.patch('/preferences', requireAuth, async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload.' });
    }

    const { supabaseAdmin } = require('../../config/supabase');
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ preferences })
      .eq('id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not save preferences.' });
  }
});