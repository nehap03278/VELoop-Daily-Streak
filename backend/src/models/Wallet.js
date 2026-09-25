const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balances: {
      // VEs - VELoop reward points (shown as the gem balance in the header).
      VES: { type: Number, default: 0, min: 0 },
      // Accumulated Amazon gift-card value in INR earned from streak rewards.
      INR: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);
