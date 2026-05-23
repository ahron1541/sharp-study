const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('./auth.controller');

// 1. IMPORT THE MISSING MIDDLEWARE HERE
const { requireAuth } = require('../../middleware/auth.middleware');
const { ipKeyGenerator } = rateLimit;

function normalizeLimiterIdentifier(req) {
  return String(
    req.user?.id ||
    req.body?.identifier ||
    req.body?.email ||
    req.body?.username ||
    req.query?.username ||
    ''
  ).trim().toLowerCase();
}

function authLimiterKey(req) {
  const identifier = normalizeLimiterIdentifier(req);
  const ipKey = ipKeyGenerator(req.ip);
  return identifier ? `${ipKey}:${identifier}` : ipKey;
}

const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.OTP_MAX_REQUESTS_PER_WINDOW || 5),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authLimiterKey,
  message: { error: 'Too many verification requests. Please wait a bit before trying again.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.MAX_LOGIN_ATTEMPTS || 8),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authLimiterKey,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const authActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_ACTION_MAX_REQUESTS_PER_WINDOW || 30),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authLimiterKey,
  message: { error: 'Too many account requests. Please wait a bit before trying again.' },
});

const usernameCheckLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.USERNAME_CHECK_MAX_REQUESTS_PER_WINDOW || 120),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'Too many username checks. Please slow down and try again.' },
});

const PROTECTED_PREFERENCE_KEYS = new Set(['streak', 'daily_goals']);

function sanitizePreferenceUpdate(preferences) {
  return Object.fromEntries(
    Object.entries(preferences || {})
      .filter(([key]) => !PROTECTED_PREFERENCE_KEYS.has(key))
  );
}

// The 4-Step Signup Flow
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.post('/signup/request-otp', otpRequestLimiter, authController.requestSignupOtp);
router.post('/signup/verify-otp', authActionLimiter, authController.verifySignupOtp);
router.get('/signup/check-username', usernameCheckLimiter, authController.checkUsername);
router.post('/signup/complete', authActionLimiter, authController.completeSignup);

// Login
router.post('/login', loginLimiter, authController.login);

// --- FORGOT PASSWORD FLOW (NEW) ---
router.post('/forgot-password/request-otp', otpRequestLimiter, authController.requestPasswordReset);
router.post('/forgot-password/verify-otp', authActionLimiter, authController.verifyResetOtp);
router.post('/forgot-password/reset', authActionLimiter, authController.resetPassword);
router.post('/change-password', requireAuth, authActionLimiter, authController.changePassword);
router.post('/email-verification/resend', requireAuth, authActionLimiter, authController.resendEmailVerification);

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
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Invalid preferences payload.' });
    }

    const { supabaseAdmin } = require('../../config/supabase');
    const { data: profile, error: loadError } = await supabaseAdmin
      .from('profiles')
      .select('preferences')
      .eq('id', req.user.id)
      .single();

    if (loadError) throw loadError;

    const currentPreferences = profile?.preferences
      && typeof profile.preferences === 'object'
      && !Array.isArray(profile.preferences)
      ? profile.preferences
      : {};
    const nextPreferences = {
      ...currentPreferences,
      ...sanitizePreferenceUpdate(preferences),
    };

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ preferences: nextPreferences })
      .eq('id', req.user.id);

    if (error) throw error;
    res.json({ success: true, preferences: nextPreferences });
  } catch (err) {
    res.status(500).json({ error: 'Could not save preferences.' });
  }
});

// 2. EXPORT MUST BE AT THE VERY BOTTOM
module.exports = router;
