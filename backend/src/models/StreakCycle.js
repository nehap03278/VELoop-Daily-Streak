const mongoose = require('mongoose');

const streakCycleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cycleNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'BROKEN'], default: 'ACTIVE' },
    totalDays: { type: Number, required: true },
    claimedDays: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    lastClaimAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    brokenAt: { type: Date, default: null },
    missedDay: { type: Number, default: null },
  },
  { timestamps: true }
);

streakCycleSchema.index({ userId: 1, cycleNumber: 1 }, { unique: true });
// A user can never have two ACTIVE cycles at the same time.
streakCycleSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' }, name: 'one_active_cycle_per_user' }
);

module.exports = mongoose.model('StreakCycle', streakCycleSchema);
