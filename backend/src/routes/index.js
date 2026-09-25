const express = require('express');
const env = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter, claimLimiter, apiLimiter } = require('../middleware/rateLimiters');
const { registerSchema, loginSchema } = require('../validators/auth.validators');
const { startClaimSchema, finalizeClaimSchema, paginationSchema, timeTravelSchema } = require('../validators/streak.validators');
const authController = require('../controllers/auth.controller');
const streakController = require('../controllers/streak.controller');
const walletController = require('../controllers/wallet.controller');
const devController = require('../controllers/dev.controller');
const clock = require('../utils/clock');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', serverTime: clock.now() }));

// Auth
router.post('/auth/register', authLimiter, validate(registerSchema), authController.register);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.get('/auth/me', requireAuth, authController.me);

// Daily streak (all protected; identity comes from the JWT only)
const streak = express.Router();
streak.use(requireAuth);
streak.get('/', apiLimiter, streakController.getDailyStreak);
streak.get('/status', apiLimiter, streakController.getStatus);
streak.get('/history', apiLimiter, validate(paginationSchema, 'query'), streakController.getHistory);
streak.post('/claim/start', claimLimiter, validate(startClaimSchema), streakController.startClaim);
streak.post('/claim', claimLimiter, validate(finalizeClaimSchema), streakController.claim);
router.use('/daily-streak', streak);

// Wallet
const wallet = express.Router();
wallet.use(requireAuth, apiLimiter);
wallet.get('/', walletController.getWallet);
wallet.get('/transactions', validate(paginationSchema, 'query'), walletController.getTransactions);
router.use('/wallet', wallet);

// Development / QA tooling - only mounted when explicitly enabled.
if (env.ENABLE_DEV_TOOLS) {
  const dev = express.Router();
  dev.use(requireAuth);
  dev.post('/time-travel', validate(timeTravelSchema), devController.timeTravel);
  dev.post('/reset-my-streak', devController.resetMyStreak);
  router.use('/dev', dev);
}

module.exports = router;
