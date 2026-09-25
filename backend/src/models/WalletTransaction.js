const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rewardType: { type: String, enum: ['VES', 'GIFT_CARD'], required: true },
    currency: { type: String, enum: ['VES', 'INR'], required: true },
    type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ['DAILY_STREAK', 'WELCOME_BONUS'], required: true },
    description: { type: String, default: '' },
    streakDay: { type: Number, default: null },
    cycleNumber: { type: Number, default: null },
    claimId: { type: String, default: null },
    // Business reference (e.g. STREAK-XXXXXXXX). Unique so the same grant can never be booked twice.
    referenceId: { type: String, required: true, unique: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: { type: String, enum: ['COMPLETED'], default: 'COMPLETED' },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
