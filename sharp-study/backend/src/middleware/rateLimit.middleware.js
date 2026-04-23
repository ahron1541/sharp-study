const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// General API rate limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please wait before trying again.',
    retryAfter: '15 minutes'
  },
  // Returns HTTP 429 Too Many Requests
});

// Strict limit for AI generation (expensive): 10 per hour per user
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  validate: false,
  keyGenerator: (req) => req.user?.id || req.ip, // per user, not just IP
  message: {
    error: 'AI generation limit reached. You can generate 10 times per hour.',
  },
});

// Throttling: deliberately slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,           // allow 50 req/15min at full speed
  delayMs: (hits) => hits * 200, // add 200ms delay per request above limit
});

// Login brute-force protection: 10 attempts per hour
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many login attempts. Please wait 1 hour.',
  },
});

module.exports = { generalLimiter, aiLimiter, speedLimiter, authLimiter };