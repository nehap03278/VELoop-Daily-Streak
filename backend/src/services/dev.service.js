const { UserStreak, StreakCycle, StreakClaim, ClaimSession } = require('../models');
const streakService = require('./streak.service');
const { audit } = require('./audit.service');

/**
 * DEVELOPMENT/QA ONLY (ENABLE_DEV_TOOLS=true). Lets a tester simulate the passage of time for their *own*
 * account by moving their stored streak timestamps into the past. Server time itself is never changed and
 * no other user is affected. Used to demonstrate the 24h unlock and the missed-day reset without waiting.
 */
async function timeTravel(user, hours, ctx = {}) {
  const ms = Math.round(hours * 60 * 60 * 1000);
  const shift = (field) => ({ $set: { [field]: { $cond: [{ $ifNull: [`$${field}`, false] }, { $subtract: [`$${field}`, ms] }, `$${field}`] } } });
  const userId = user._id;

  await Promise.all([
    UserStreak.updateOne({ userId }, [
      shift('lastClaimAt'),
      {
        $set: {
          lastReset: {
            $cond: [
              { $ifNull: ['$lastReset.at', false] },
              { $mergeObjects: ['$lastReset', { at: { $subtract: ['$lastReset.at', ms] } }] },
              '$lastReset',
            ],
          },
          version: { $add: ['$version', 1] },
        },
      },
    ]),
    StreakClaim.updateMany({ userId }, [shift('claimedAt')]),
    StreakCycle.updateMany({ userId }, [shift('lastClaimAt'), shift('startedAt')]),
    ClaimSession.updateMany({ userId, status: 'PENDING' }, [shift('readyAt'), shift('expiresAt')]),
  ]);
  await audit('DEV_TIME_TRAVEL', { userId, req: ctx.req, metadata: { hours } });
  return streakService.getStatus(user, ctx);
}

/** Clears the caller's streak (not the wallet ledger, which is append-only) so a demo can start over. */
async function resetMyStreak(user, ctx = {}) {
  const userId = user._id;
  await Promise.all([
    UserStreak.deleteOne({ userId }),
    StreakCycle.deleteMany({ userId }),
    StreakClaim.deleteMany({ userId }),
    ClaimSession.deleteMany({ userId }),
  ]);
  await audit('DEV_STREAK_RESET', { userId, req: ctx.req });
  return streakService.getStatus(user, ctx);
}

module.exports = { timeTravel, resetMyStreak };
