const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const clock = require('../utils/clock');

function limiter({ windowMs, limit, keyByUser = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Authenticated routes are limited per account, public routes per IP.
    keyGenerator: (req) => (keyByUser && req.user ? `user:${req.user._id}` : ipKeyGenerator(req.ip)),
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again shortly.' },
        serverTime: clock.now(),
      }),
  });
}

const isTest = process.env.NODE_ENV === 'test';

module.exports = {
  // Brute-force protection for login/register.
  authLimiter: limiter({ windowMs: 15 * 60 * 1000, limit: isTest ? 1000 : 20 }),
  // Claims: generous enough for real use, tight enough to stop scripted hammering.
  claimLimiter: limiter({ windowMs: 60 * 1000, limit: isTest ? 1000 : 20, keyByUser: true }),
  apiLimiter: limiter({ windowMs: 60 * 1000, limit: isTest ? 5000 : 120, keyByUser: true }),
};
