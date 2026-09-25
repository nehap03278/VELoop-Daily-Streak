const mongoose = require('mongoose');

const streakRewardSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1, max: 31 },
    rewardType: { type: String, enum: ['VES', 'GIFT_CARD'], required: true },
    currency: { type: String, enum: ['VES', 'INR'], required: true },
    amount: { type: Number, required: true, min: 0 },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    description: { type: String, default: '' },
    // Identifier only - the actual image lives in the frontend bundle.
    assetType: { type: String, enum: ['coin', 'gift-box', 'gift-card', 'crown'], required: true },
    badge: { type: String, default: null },
    isUltimate: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Only one active reward per day slot.
streakRewardSchema.index({ day: 1 }, { unique: true, partialFilterExpression: { active: true } });

module.exports = mongoose.model('StreakReward', streakRewardSchema);
