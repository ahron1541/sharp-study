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