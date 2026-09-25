const mongoose = require('mongoose');

/**
 * Singleton document (key = "default") holding every streak business rule.
 * Changing these values changes the behaviour of the live system without a code change.
 */
const streakConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    // Minimum wait after a claim before the next day unlocks.
    claimIntervalMinutes: { type: Number, required: true, min: 1 },
    // After unlocking, how long the user has to claim before the streak is considered missed.
    claimWindowMinutes: { type: Number, required: true, min: 1 },
    // Length of the CPA / advertisement demo the user must sit through before the claim can be confirmed.
    cpaDemoSeconds: { type: Number, required: true, min: 0, max: 120 },
    claimSessionTtlMinutes: { type: Number, required: true, min: 1, max: 60 },
    requireCpaVerification: { type: Boolean, default: true },
    // What happens on a missed day. Only RESET_TO_DAY_1 is implemented (documented in README).
    resetRule: { type: String, enum: ['RESET_TO_DAY_1'], default: 'RESET_TO_DAY_1' },
    // What happens after the final day: a new cycle starts at Day 1 (streak count keeps growing).
    cycleCompletionRule: { type: String, enum: ['START_NEW_CYCLE'], default: 'START_NEW_CYCLE' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StreakConfig', streakConfigSchema);
