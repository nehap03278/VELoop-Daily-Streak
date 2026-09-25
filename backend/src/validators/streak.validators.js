const { z } = require('zod');

// `day` is optional and only ever compared with the backend-derived current day.
const day = z.coerce.number({ invalid_type_error: 'day must be a number.' }).int('day must be a whole number.').min(1).max(31).optional();

const startClaimSchema = z.object({ day });

const finalizeClaimSchema = z.object({
  claimSessionId: z.string().uuid('claimSessionId is invalid.').optional(),
  day,
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const timeTravelSchema = z.object({
  hours: z.coerce.number().positive().max(24 * 30),
});

/**
 * Fields a client might send to manipulate a claim. They are never read by the backend;
 * their presence is only recorded in the audit log.
 */
const TAMPER_FIELDS = ['reward', 'amount', 'currency', 'rewardType', 'streak', 'currentStreak', 'currentDay', 'userId', 'user', 'balance', 'nextClaimAt', 'serverTime', 'status', 'claimed'];

function findTamperedFields(body) {
  if (!body || typeof body !== 'object') return [];
  return TAMPER_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
}

module.exports = { startClaimSchema, finalizeClaimSchema, paginationSchema, timeTravelSchema, findTamperedFields };
