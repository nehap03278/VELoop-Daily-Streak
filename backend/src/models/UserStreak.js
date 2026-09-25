const mongoose = require('mongoose');

/**
 * Authoritative per-user streak state. Every mutation is a compare-and-set on `version`
 * (optimistic locking) so concurrent claims/resets can never both succeed.
 */
const userStreakSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    activeCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreakCycle', required: true },
    cycleNumber: { type: Number, required: true, default: 1 },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    // Highest day claimed inside the active cycle (0 = nothing claimed yet in this cycle).
    lastClaimedDay: { type: Number, default: 0, min: 0 },
    // Server timestamp of the most recent successful claim (any cycle).
    lastClaimAt: { type: Date, default: null },
    totalClaims: { type: Number, default: 0 },
    lastReset: {
      type: new mongoose.Schema(
        {
          at: Date,
          missedDay: Number,
          previousStreak: Number,
          claimedDays: Number,
          cycleNumber: Number,
        },
        { _id: false }
      ),
      default: null,
    },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserStreak', userStreakSchema);
