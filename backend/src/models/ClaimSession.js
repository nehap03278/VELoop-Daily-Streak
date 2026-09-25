const mongoose = require('mongoose');

/**
 * Server-side record of a claim that has been validated and is waiting for the CPA/ad demo to finish.
 * The session id doubles as the idempotency key for POST /claim.
 */
const claimSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Cycle the claim belongs to (may be the next cycle when the previous one was just completed).
    cycleNumber: { type: Number, required: true },
    day: { type: Number, required: true },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreakReward', required: true },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'], default: 'PENDING' },
    readyAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    rejectionCode: { type: String, default: null },
  },
  { timestamps: true }
);

claimSessionSchema.index({ userId: 1, createdAt: -1 });
// Housekeeping: sessions are removed a day after they expire.
claimSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('ClaimSession', claimSessionSchema);
