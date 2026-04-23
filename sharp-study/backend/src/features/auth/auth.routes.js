const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

// Signup flow
router.post('/signup/request-otp', authController.requestSignupOtp);
router.post('/signup/verify', authController.verifySignupAndCreateUser);

// Login
router.post('/login', authController.login);

module.exports = router;