/**
 * Pure streak rules. No database, no I/O - every decision is a function of
 * (stored streak state, backend configuration, server time).
 *
 * Timeline after a claim at T (interval I, window W - both from StreakConfig):
 *
 *   T ─────── I ───────▶ unlockAt ─────── W ───────▶ deadline
 *   [ next day LOCKED  ] [ next day AVAILABLE      ] [ streak MISSED -> reset to Day 1 ]
 */

const MINUTE = 60 * 1000;

function toMs(date) {
  return date ? new Date(date).getTime() : null;
}

/**
 * @param {object} streak   UserStreak document (plain or hydrated)
 * @param {object} config   StreakConfig document
 * @param {number} totalDays number of active reward days in a cycle
 * @param {Date}   now      trusted server time
 */
function evaluate(streak, config, totalDays, now) {
  const nowMs = now.getTime();
  const intervalMs = config.claimIntervalMinutes * MINUTE;
  const windowMs = config.claimWindowMinutes * MINUTE;

  const lastClaimAt = toMs(streak.lastClaimAt);
  const unlockAt = lastClaimAt === null ? null : lastClaimAt + intervalMs;
  const deadline = unlockAt === null ? null : unlockAt + windowMs;

  const cycleComplete = streak.lastClaimedDay >= totalDays;
  // Claims already made inside the cycle that the *next* claim belongs to.
  const claimedInCycle = cycleComplete ? 0 : streak.lastClaimedDay;
  const currentDay = claimedInCycle + 1;

  const missed = streak.currentStreak > 0 && deadline !== null && nowMs >= deadline;
  const claimable = !missed && (unlockAt === null || nowMs >= unlockAt);

  return {
    missed,
    missedDay: missed ? currentDay : null,
    cycleComplete,
    claimedInCycle,
    currentDay,
    claimable,
    unlockAt: unlockAt === null ? null : new Date(unlockAt),
    deadline: deadline === null ? null : new Date(deadline),
    // The next claim opens a new cycle when the previous one was completed.
    needsNewCycle: cycleComplete,
    targetCycleNumber: cycleComplete ? streak.cycleNumber + 1 : streak.cycleNumber,
  };
}

/**
 * Decides the state of each reward card for the cycle that should be displayed.
 * While a completed cycle is still inside its waiting period it stays on screen (all CLAIMED);
 * once the next Day 1 unlocks, a fresh cycle is presented.
 */
function buildDayStates({ evaluation, rewards, claimsByDay }) {
  const showCompletedCycle = evaluation.cycleComplete && !evaluation.claimable;

  return rewards.map((reward) => {
    const day = reward.day;
    const claim = claimsByDay.get(day);
    const base = { day, isToday: false, isNext: false, claimedAt: null, unlocksAt: null };

    if (showCompletedCycle || day <= evaluation.claimedInCycle) {
      return { ...base, status: 'CLAIMED', claimedAt: claim ? claim.claimedAt : null };
    }
    if (day === evaluation.currentDay) {
      if (evaluation.claimable) return { ...base, status: 'AVAILABLE', isToday: true };
      return { ...base, status: 'LOCKED', isNext: true, unlocksAt: evaluation.unlockAt };
    }
    return { ...base, status: 'LOCKED' };
  });
}

module.exports = { evaluate, buildDayStates, MINUTE };
