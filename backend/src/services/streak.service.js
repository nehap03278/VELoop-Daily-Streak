const mongoose = require('mongoose');
const { UserStreak, StreakCycle, StreakClaim, ClaimSession } = require('../models');
const AppError = require('../utils/AppError');
const clock = require('../utils/clock');
const ids = require('../utils/ids');
const { runInTransaction } = require('../utils/transaction');
const { supportsTransactions } = require('../config/db');
const { evaluate, buildDayStates, MINUTE } = require('../utils/streakCalculator');
const { getStreakConfig } = require('./config.service');
const rewardService = require('./reward.service');
const walletService = require('./wallet.service');
const transactionService = require('./transaction.service');
const { audit } = require('./audit.service');

const MAX_STATE_ATTEMPTS = 5;
const isDuplicateKey = (error) => Boolean(error && error.code === 11000);

const errors = {
  streakReset: () =>
    new AppError(409, 'STREAK_RESET', 'Your streak has been reset. Start again from Day 1.'),
  alreadyClaimed: () => new AppError(409, 'ALREADY_CLAIMED', 'This reward has already been claimed.'),
  locked: (nextClaimAt, day) =>
    new AppError(409, 'REWARD_LOCKED', 'Your next reward is not available yet.', { nextClaimAt, day }),
};

/* ------------------------------------------------------------------------------------------------
 * State loading
 * ---------------------------------------------------------------------------------------------- */

/** Creates the user's streak record and first cycle on first access (race-safe via unique indexes). */
async function ensureStreak(userId, totalDays, now) {
  const existing = await UserStreak.findOne({ userId });
  if (existing) return existing;

  let cycle;
  try {
    cycle = await StreakCycle.create({ userId, cycleNumber: 1, totalDays, startedAt: now });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    cycle = await StreakCycle.findOne({ userId, cycleNumber: 1 });
  }

  try {
    return await UserStreak.create({ userId, activeCycleId: cycle._id, cycleNumber: 1 });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return UserStreak.findOne({ userId });
  }
}

/**
 * Applies the missed-day rule: the streak drops to 0, the broken cycle is closed and a new cycle opens at Day 1.
 * Compare-and-set on `version` guarantees a concurrent claim and reset can't both win.
 */
async function resetStreak(streak, evaluation, totalDays, now) {
  const hadClaims = streak.lastClaimedDay > 0;
  const newCycleId = new mongoose.Types.ObjectId();
  const newCycleNumber = streak.cycleNumber + 1;

  const set = {
    currentStreak: 0,
    lastClaimedDay: 0,
    lastReset: {
      at: now,
      missedDay: evaluation.missedDay,
      previousStreak: streak.currentStreak,
      claimedDays: evaluation.claimedInCycle,
      cycleNumber: evaluation.targetCycleNumber,
    },
  };
  if (hadClaims) Object.assign(set, { activeCycleId: newCycleId, cycleNumber: newCycleNumber });

  return runInTransaction(async (session) => {
    const updated = await UserStreak.findOneAndUpdate(
      { _id: streak._id, version: streak.version },
      { $set: set, $inc: { version: 1 } },
      { new: true, session }
    );
    if (!updated) return null;

    if (hadClaims) {
      if (!evaluation.cycleComplete) {
        await StreakCycle.updateOne(
          { _id: streak.activeCycleId, status: 'ACTIVE' },
          { $set: { status: 'BROKEN', brokenAt: now, missedDay: evaluation.missedDay } },
          { session }
        );
      }
      await StreakCycle.create(
        [{ _id: newCycleId, userId: streak.userId, cycleNumber: newCycleNumber, totalDays, startedAt: now }],
        { session }
      );
    }
    return updated;
  });
}

/**
 * Loads config, rewards and the user's streak, applying a missed-day reset when the claim window has passed.
 * Everything is evaluated against a single trusted server timestamp.
 */
async function loadState(userId, { req } = {}) {
  const [config, rewards] = await Promise.all([getStreakConfig(), rewardService.getActiveRewards()]);
  const totalDays = rewards.length;
  const now = clock.now();

  let streak = await ensureStreak(userId, totalDays, now);
  let resetInfo = null;

  for (let attempt = 0; attempt < MAX_STATE_ATTEMPTS; attempt += 1) {
    const evaluation = evaluate(streak, config, totalDays, now);
    if (!evaluation.missed) return { config, rewards, totalDays, now, streak, evaluation, resetInfo };

    const updated = await resetStreak(streak, evaluation, totalDays, now);
    if (updated) {
      resetInfo = updated.lastReset;
      await audit('STREAK_RESET', {
        userId,
        req,
        metadata: {
          missedDay: evaluation.missedDay,
          previousStreak: streak.currentStreak,
          lastClaimAt: streak.lastClaimAt,
          deadline: evaluation.deadline,
          detectedAt: now,
        },
      });
      streak = updated;
    } else {
      streak = await UserStreak.findOne({ userId });
    }
  }
  throw new AppError(409, 'STREAK_BUSY', 'Your streak is being updated. Please try again.');
}

/* ------------------------------------------------------------------------------------------------
 * Read models
 * ---------------------------------------------------------------------------------------------- */

function buildResetNotice(streak, totalDays) {
  const reset = streak.lastReset;
  if (!reset || !reset.at) return null;
  // The notice stays until the user claims again after the reset.
  if (streak.lastClaimAt && new Date(streak.lastClaimAt) > new Date(reset.at)) return null;

  const days = [];
  for (let day = 1; day <= totalDays; day += 1) {
    let status = 'LOCKED';
    if (day <= reset.claimedDays) status = 'CLAIMED';
    else if (day === reset.missedDay) status = 'MISSED';
    days.push({ day, status });
  }
  return {
    at: reset.at,
    missedDay: reset.missedDay,
    previousStreak: reset.previousStreak,
    claimedDays: reset.claimedDays,
    message: 'Your streak has been reset. Start again from Day 1.',
    days,
  };
}

function buildSummary(state) {
  const { streak, evaluation, totalDays } = state;
  const showCompletedCycle = evaluation.cycleComplete && !evaluation.claimable;
  const resetNotice = buildResetNotice(streak, totalDays);

  let status = 'NEW';
  if (streak.currentStreak > 0) status = 'ACTIVE';
  else if (resetNotice) status = 'RESET';

  return {
    status,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    currentDay: evaluation.currentDay,
    checkedIn: showCompletedCycle ? totalDays : evaluation.claimedInCycle,
    totalRewards: totalDays,
    cycleNumber: showCompletedCycle ? streak.cycleNumber : evaluation.targetCycleNumber,
    cycleCompleted: showCompletedCycle,
    claimable: evaluation.claimable,
    nextClaimAt: evaluation.claimable ? null : evaluation.unlockAt,
    streakExpiresAt: streak.currentStreak > 0 ? evaluation.deadline : null,
    lastClaimAt: streak.lastClaimAt,
    totalClaims: streak.totalClaims,
  };
}

async function getDailyStreak(user, ctx = {}) {
  const state = await loadState(user._id, ctx);
  const { evaluation, streak, rewards, config, totalDays } = state;
  const showCompletedCycle = evaluation.cycleComplete && !evaluation.claimable;
  const claimsCycleId = !evaluation.cycleComplete || showCompletedCycle ? streak.activeCycleId : null;

  const [claims, balances] = await Promise.all([
    claimsCycleId ? StreakClaim.find({ userId: user._id, cycleId: claimsCycleId }).lean() : [],
    walletService.getBalances(user._id),
  ]);

  const claimsByDay = new Map(claims.map((claim) => [claim.day, claim]));
  const rewardDTOs = rewards.map(rewardService.toRewardDTO);
  const resetNotice = buildResetNotice(streak, totalDays);
  const missedDay = resetNotice ? resetNotice.missedDay : null;
  const cards = buildDayStates({ evaluation, rewards, claimsByDay, missedDay }).map((card, index) => ({
    ...card,
    reward: rewardDTOs[index],
  }));

  const summary = buildSummary(state);
  const ultimate = rewardService.getUltimateReward(rewards);
  const ultimateCard = cards.find((card) => card.day === ultimate.day);

  return {
    serverTime: state.now,
    user: { id: user._id.toString(), name: user.name },
    wallet: balances,
    streak: summary,
    stats: {
      totalRewards: totalDays,
      checkedIn: summary.checkedIn,
      nextReward: rewardDTOs[evaluation.currentDay - 1],
    },
    ultimateReward: {
      ...rewardService.toRewardDTO(ultimate),
      unlockDay: ultimate.day,
      status: ultimateCard ? ultimateCard.status : 'LOCKED',
      state: ultimateCard ? ultimateCard.state : 'LOCKED',
    },
    rewards: cards,
    resetNotice,
    cpa: { required: config.requireCpaVerification, durationSeconds: config.cpaDemoSeconds },
    rules: {
      claimIntervalMinutes: config.claimIntervalMinutes,
      claimWindowMinutes: config.claimWindowMinutes,
    },
  };
}

async function getStatus(user, ctx = {}) {
  const state = await loadState(user._id, ctx);
  return { serverTime: state.now, streak: buildSummary(state) };
}

/* ------------------------------------------------------------------------------------------------
 * Claim validation
 * ---------------------------------------------------------------------------------------------- */

/**
 * Independent server-side eligibility check, run on every claim request (spec section 12).
 * `requestedDay` is optional and only ever compared against the backend-derived day.
 */
async function assertEligible(state, user, requestedDay) {
  const { evaluation, streak, totalDays } = state;
  const currentDay = evaluation.currentDay;

  // Current day correct? The client can never choose the day.
  if (requestedDay !== undefined && requestedDay !== currentDay) {
    const showingCompletedCycle = evaluation.cycleComplete && !evaluation.claimable;
    if (requestedDay > totalDays) {
      throw new AppError(400, 'INVALID_DAY', `Day ${requestedDay} does not exist in this streak.`);
    }
    if (showingCompletedCycle || requestedDay < currentDay) throw errors.alreadyClaimed();
    throw new AppError(403, 'DAY_NOT_ELIGIBLE', `Day ${requestedDay} is locked. Your current reward is Day ${currentDay}.`, {
      currentDay,
    });
  }

  // Previous day claimed? Verified against the claim ledger, not just the counter.
  if (currentDay > 1) {
    const previous = await StreakClaim.exists({ userId: user._id, cycleId: streak.activeCycleId, day: currentDay - 1 });
    if (!previous) {
      throw new AppError(409, 'PREVIOUS_DAY_NOT_CLAIMED', `Day ${currentDay - 1} must be claimed first.`);
    }
  }

  // Required waiting period completed? (server time only)
  if (!evaluation.claimable) throw errors.locked(evaluation.unlockAt, currentDay);

  // Today's reward not already claimed?
  if (!evaluation.needsNewCycle) {
    const already = await StreakClaim.exists({ userId: user._id, cycleId: streak.activeCycleId, day: currentDay });
    if (already) throw errors.alreadyClaimed();
  }

  // User account eligible?
  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_INELIGIBLE', 'Your account is not eligible for rewards.');
  }

  return { day: currentDay, cycleNumber: evaluation.targetCycleNumber, reward: state.rewards[currentDay - 1] };
}

/* ------------------------------------------------------------------------------------------------
 * Reward grant
 * ---------------------------------------------------------------------------------------------- */

function buildClaimResult({ claimId, day, cycleNumber, now, referenceId, reward, transactionId, credit, streak, config, completesCycle }) {
  return {
    claim: { claimId, day, cycleNumber, claimedAt: now, referenceId, status: 'COMPLETED' },
    reward: rewardService.toRewardDTO(reward),
    transaction: {
      transactionId,
      referenceId,
      source: 'DAILY_STREAK',
      rewardType: reward.rewardType,
      amount: reward.amount,
      currency: reward.currency,
      balanceBefore: credit.balanceBefore,
      balanceAfter: credit.balanceAfter,
    },
    wallet: credit.balances,
    streak: {
      currentStreak: streak.currentStreak,
      nextClaimAt: new Date(now.getTime() + config.claimIntervalMinutes * MINUTE),
      cycleCompleted: completesCycle,
    },
    serverTime: now,
  };
}

/**
 * Grants the reward: claim record -> streak state -> wallet credit -> ledger entry -> cycle bookkeeping.
 * Runs in a MongoDB transaction when available. On a standalone server the unique claim index and the
 * version compare-and-set still prevent double grants, and completed steps are compensated on failure.
 */
async function grantReward({ user, state, target, claimSessionId, ctx }) {
  const { streak, evaluation, totalDays, now, config } = state;
  const { day, reward, cycleNumber } = target;
  const userId = user._id;

  const claimId = ids.claimId();
  const transactionId = ids.transactionId();
  const referenceId = ids.streakReference();
  const opensNewCycle = evaluation.needsNewCycle;
  const cycleId = opensNewCycle ? new mongoose.Types.ObjectId() : streak.activeCycleId;
  const completesCycle = day === totalDays;
  const newStreak = streak.currentStreak + 1;
  const done = {};

  const work = async (session) => {
    if (opensNewCycle) {
      await StreakCycle.create([{ _id: cycleId, userId, cycleNumber, totalDays, startedAt: now }], { session });
      done.cycle = true;
    }

    // 1. Claim record - the unique (userId, cycleId, day) index makes this the duplicate-claim lock.
    await StreakClaim.create(
      [
        {
          claimId,
          userId,
          cycleId,
          cycleNumber,
          day,
          rewardId: reward._id,
          reward: {
            rewardType: reward.rewardType,
            currency: reward.currency,
            amount: reward.amount,
            title: reward.title,
            subtitle: reward.subtitle,
          },
          claimedAt: now,
          transactionId,
          referenceId,
          claimSessionId,
        },
      ],
      { session }
    );
    done.claim = true;

    // 2. Advance the streak only if nobody else changed it since we evaluated it.
    const updatedStreak = await UserStreak.findOneAndUpdate(
      {
        _id: streak._id,
        version: streak.version,
        lastClaimedDay: streak.lastClaimedDay,
        activeCycleId: streak.activeCycleId,
      },
      {
        $set: {
          activeCycleId: cycleId,
          cycleNumber,
          lastClaimedDay: day,
          lastClaimAt: now,
          currentStreak: newStreak,
          longestStreak: Math.max(streak.longestStreak, newStreak),
        },
        $inc: { version: 1, totalClaims: 1 },
      },
      { new: true, session }
    );
    if (!updatedStreak) {
      throw new AppError(409, 'CLAIM_CONFLICT', 'This reward was just processed by another request. Please refresh.');
    }
    done.streak = true;

    // 3. Credit the real wallet with the configured reward (never a client value).
    const credit = await walletService.credit(userId, reward.currency, reward.amount, session);
    done.credit = true;

    // 4. Ledger entry.
    await transactionService.recordTransaction(
      {
        transactionId,
        userId,
        rewardType: reward.rewardType,
        currency: reward.currency,
        amount: reward.amount,
        source: 'DAILY_STREAK',
        description: `Daily streak Day ${day} - ${reward.subtitle}`,
        streakDay: day,
        cycleNumber,
        claimId,
        referenceId,
        balanceBefore: credit.balanceBefore,
        balanceAfter: credit.balanceAfter,
      },
      session
    );
    done.transaction = true;

    // 5. Cycle bookkeeping.
    await StreakCycle.updateOne(
      { _id: cycleId },
      {
        $inc: { claimedDays: 1 },
        $set: { lastClaimAt: now, ...(completesCycle ? { status: 'COMPLETED', completedAt: now } : {}) },
      },
      { session }
    );

    const result = buildClaimResult({
      claimId,
      day,
      cycleNumber,
      now,
      referenceId,
      reward,
      transactionId,
      credit,
      streak: updatedStreak,
      config,
      completesCycle,
    });

    if (claimSessionId) {
      await ClaimSession.updateOne({ sessionId: claimSessionId }, { $set: { status: 'COMPLETED', result } }, { session });
    }
    return result;
  };

  let result;
  try {
    result = await runInTransaction(work);
  } catch (error) {
    if (!supportsTransactions()) await compensate({ done, userId, reward, streak, claimId, transactionId, cycleId });
    if (isDuplicateKey(error)) throw errors.alreadyClaimed();
    throw error;
  }

  await audit('STREAK_CLAIM_SUCCESS', {
    userId,
    req: ctx.req,
    metadata: { day, cycleNumber, claimId, transactionId, referenceId, amount: reward.amount, currency: reward.currency },
  });
  if (completesCycle) {
    await audit('STREAK_CYCLE_COMPLETED', { userId, req: ctx.req, metadata: { cycleNumber } });
  }
  return result;
}

/** Best-effort rollback for standalone MongoDB deployments (no multi-document transactions). */
async function compensate({ done, userId, reward, streak, claimId, transactionId, cycleId }) {
  const steps = [];
  if (done.transaction) steps.push(() => transactionService.deleteByTransactionId(transactionId));
  if (done.credit) steps.push(() => walletService.reverseCredit(userId, reward.currency, reward.amount));
  if (done.streak) {
    steps.push(() =>
      UserStreak.updateOne(
        { _id: streak._id, version: streak.version + 1 },
        {
          $set: {
            activeCycleId: streak.activeCycleId,
            cycleNumber: streak.cycleNumber,
            lastClaimedDay: streak.lastClaimedDay,
            lastClaimAt: streak.lastClaimAt,
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
          },
          $inc: { version: 1, totalClaims: -1 },
        }
      )
    );
  }
  if (done.claim) steps.push(() => StreakClaim.deleteOne({ claimId }));
  if (done.cycle) steps.push(() => StreakCycle.deleteOne({ _id: cycleId }));

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      console.error('[claim] compensation step failed:', error.message);
    }
  }
}

/* ------------------------------------------------------------------------------------------------
 * Claim endpoints
 * ---------------------------------------------------------------------------------------------- */

const DUPLICATE_CODES = new Set(['ALREADY_CLAIMED', 'CLAIM_IN_PROGRESS', 'CLAIM_CONFLICT']);
const INVALID_CODES = new Set([
  'DAY_NOT_ELIGIBLE',
  'INVALID_DAY',
  'DAY_MISMATCH',
  'PREVIOUS_DAY_NOT_CLAIMED',
  'CLAIM_SESSION_NOT_FOUND',
  'CLAIM_SESSION_STALE',
]);

async function auditRejection(error, user, ctx, phase) {
  if (!(error instanceof AppError)) return;
  const metadata = { phase, code: error.code, details: error.details || null };
  await audit('STREAK_CLAIM_REJECTED', { userId: user._id, req: ctx.req, metadata });
  if (DUPLICATE_CODES.has(error.code)) await audit('DUPLICATE_CLAIM', { userId: user._id, req: ctx.req, metadata });
  if (INVALID_CODES.has(error.code)) await audit('INVALID_CLAIM', { userId: user._id, req: ctx.req, metadata });
}

/**
 * Phase 1: validate eligibility and open a CPA/ad verification session.
 * Nothing is granted here - the reward is only granted by finalizeClaim once the server says the ad is done.
 */
async function startClaim(user, { day }, ctx = {}) {
  await audit('STREAK_CLAIM_REQUEST', { userId: user._id, req: ctx.req, metadata: { phase: 'START', requestedDay: day ?? null } });
  try {
    const state = await loadState(user._id, ctx);
    if (state.resetInfo) throw errors.streakReset();
    const target = await assertEligible(state, user, day);
    const { config, now } = state;

    if (!config.requireCpaVerification) {
      const result = await grantReward({ user, state, target, claimSessionId: null, ctx });
      return { cpaRequired: false, ...result, idempotent: false };
    }

    const session = await ClaimSession.create({
      sessionId: ids.claimSessionId(),
      userId: user._id,
      cycleNumber: target.cycleNumber,
      day: target.day,
      rewardId: target.reward._id,
      readyAt: new Date(now.getTime() + config.cpaDemoSeconds * 1000),
      expiresAt: new Date(now.getTime() + config.claimSessionTtlMinutes * MINUTE),
    });

    return {
      cpaRequired: true,
      serverTime: now,
      claimSession: {
        id: session.sessionId,
        day: session.day,
        cycleNumber: session.cycleNumber,
        readyAt: session.readyAt,
        expiresAt: session.expiresAt,
        durationSeconds: config.cpaDemoSeconds,
      },
      reward: rewardService.toRewardDTO(target.reward),
    };
  } catch (error) {
    await auditRejection(error, user, ctx, 'START');
    throw error;
  }
}

async function resultForClosedSession(session) {
  if (session.status === 'COMPLETED' && session.result) return { ...session.result, idempotent: true };
  if (session.status === 'PROCESSING') {
    // If the grant committed but the session update did not, the claim ledger still proves the outcome.
    const claim = await StreakClaim.exists({ claimSessionId: session.sessionId });
    if (claim) throw errors.alreadyClaimed();
    throw new AppError(409, 'CLAIM_IN_PROGRESS', 'Your reward is already being processed.');
  }
  throw new AppError(409, session.rejectionCode || 'CLAIM_SESSION_CLOSED', 'This claim can no longer be completed. Please refresh and try again.');
}

/**
 * Phase 2: after the CPA demo, re-validate everything and grant the reward exactly once.
 * Repeating the call with the same claimSessionId returns the original result (idempotent).
 */
async function finalizeClaim(user, { claimSessionId, day }, ctx = {}) {
  await audit('STREAK_CLAIM_REQUEST', {
    userId: user._id,
    req: ctx.req,
    metadata: { phase: 'FINALIZE', claimSessionId: claimSessionId || null, requestedDay: day ?? null },
  });

  try {
    if (!claimSessionId) {
      const config = await getStreakConfig();
      if (config.requireCpaVerification) {
        throw new AppError(400, 'CPA_VERIFICATION_REQUIRED', 'Please complete the reward verification first.');
      }
      return startClaim(user, { day }, ctx);
    }

    const now = clock.now();
    // Scoped by the authenticated user: another user's session id is simply "not found".
    const session = await ClaimSession.findOne({ sessionId: claimSessionId, userId: user._id });
    if (!session) throw new AppError(404, 'CLAIM_SESSION_NOT_FOUND', 'This claim request was not found. Please try again.');

    if (session.status !== 'PENDING') {
      const result = await resultForClosedSession(session);
      await audit('DUPLICATE_CLAIM', { userId: user._id, req: ctx.req, metadata: { claimSessionId, idempotent: true } });
      return result;
    }
    if (day !== undefined && day !== session.day) {
      throw new AppError(400, 'DAY_MISMATCH', 'The requested day does not match this claim.');
    }
    if (now < session.readyAt) {
      throw new AppError(425, 'CPA_NOT_COMPLETED', 'Reward verification is still in progress.', { readyAt: session.readyAt });
    }
    if (now >= session.expiresAt) {
      await ClaimSession.updateOne({ _id: session._id, status: 'PENDING' }, { $set: { status: 'REJECTED', rejectionCode: 'CLAIM_SESSION_EXPIRED' } });
      throw new AppError(410, 'CLAIM_SESSION_EXPIRED', 'This claim request has expired. Please try again.');
    }

    // Atomically take ownership of the session so concurrent finalize calls can't both proceed.
    const locked = await ClaimSession.findOneAndUpdate(
      { _id: session._id, status: 'PENDING' },
      { $set: { status: 'PROCESSING' } },
      { new: true }
    );
    if (!locked) return resultForClosedSession(await ClaimSession.findById(session._id));

    try {
      const state = await loadState(user._id, ctx);
      if (state.resetInfo) throw errors.streakReset();
      const target = await assertEligible(state, user, session.day);
      if (target.cycleNumber !== session.cycleNumber) {
        throw new AppError(409, 'CLAIM_SESSION_STALE', 'Your streak changed since this claim started. Please refresh.');
      }
      const result = await grantReward({ user, state, target, claimSessionId: session.sessionId, ctx });
      return { ...result, idempotent: false };
    } catch (error) {
      const update =
        error instanceof AppError
          ? { status: 'REJECTED', rejectionCode: error.code }
          : { status: 'PENDING' }; // unexpected failure: nothing was granted, allow a retry
      await ClaimSession.updateOne({ _id: session._id, status: 'PROCESSING' }, { $set: update });
      throw error;
    }
  } catch (error) {
    await auditRejection(error, user, ctx, 'FINALIZE');
    throw error;
  }
}

/* ------------------------------------------------------------------------------------------------
 * History
 * ---------------------------------------------------------------------------------------------- */

async function getHistory(user, { page = 1, limit = 20 } = {}) {
  const userId = user._id;
  const [claims, total, cycles] = await Promise.all([
    StreakClaim.find({ userId }).sort({ claimedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StreakClaim.countDocuments({ userId }),
    StreakCycle.find({ userId }).sort({ cycleNumber: -1 }).limit(20).lean(),
  ]);

  return {
    serverTime: clock.now(),
    claims: claims.map((claim) => ({
      claimId: claim.claimId,
      day: claim.day,
      cycleNumber: claim.cycleNumber,
      status: claim.status,
      claimedAt: claim.claimedAt,
      reward: { ...claim.reward, displayValue: rewardService.displayValue(claim.reward) },
      transactionId: claim.transactionId,
      referenceId: claim.referenceId,
    })),
    cycles: cycles.map((cycle) => ({
      cycleNumber: cycle.cycleNumber,
      status: cycle.status,
      totalDays: cycle.totalDays,
      claimedDays: cycle.claimedDays,
      startedAt: cycle.startedAt,
      completedAt: cycle.completedAt,
      brokenAt: cycle.brokenAt,
      missedDay: cycle.missedDay,
    })),
    page,
    limit,
    total,
  };
}

/** Called on registration so the streak and wallet exist from the start. */
async function initializeUser(userId) {
  const rewards = await rewardService.getActiveRewards();
  await Promise.all([ensureStreak(userId, rewards.length, clock.now()), walletService.getOrCreateWallet(userId)]);
}

module.exports = {
  getDailyStreak,
  getStatus,
  startClaim,
  finalizeClaim,
  getHistory,
  initializeUser,
  ensureStreak,
  loadState,
};
