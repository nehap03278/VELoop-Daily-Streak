const mongoose = require('mongoose');

const streakClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreakCycle', required: true },
    cycleNumber: { type: Number, required: true },
    day: { type: Number, required: true },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreakReward', required: true },
    // Snapshot of the reward at claim time so later config changes never rewrite history.
    reward: {
      rewardType: String,
      currency: String,
      amount: Number,
      title: String,
      subtitle: String,
    },
    status: { type: String, enum: ['COMPLETED'], default: 'COMPLETED' },
    claimedAt: { type: Date, required: true },
    transactionId: { type: String, required: true },
    referenceId: { type: String, required: true },
    claimSessionId: { type: String, default: null },
  },
  { timestamps: true }
);

// Core duplicate-claim guard: a day can be claimed once per cycle per user, enforced by MongoDB itself.
streakClaimSchema.index({ userId: 1, cycleId: 1, day: 1 }, { unique: true });
streakClaimSchema.index({ userId: 1, claimedAt: -1 });
streakClaimSchema.index(
  { claimSessionId: 1 },
  { unique: true, partialFilterExpression: { claimSessionId: { $type: 'string' } } }
);

module.exports = mongoose.model('StreakClaim', streakClaimSchema);
