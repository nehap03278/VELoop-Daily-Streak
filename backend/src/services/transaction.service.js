const { WalletTransaction } = require('../models');

async function recordTransaction(data, session = null) {
  const [transaction] = await WalletTransaction.create([{ type: 'CREDIT', status: 'COMPLETED', ...data }], { session });
  return transaction;
}

function toTransactionDTO(transaction) {
  return {
    transactionId: transaction.transactionId,
    type: transaction.type,
    rewardType: transaction.rewardType,
    amount: transaction.amount,
    currency: transaction.currency,
    source: transaction.source,
    description: transaction.description,
    streakDay: transaction.streakDay,
    cycleNumber: transaction.cycleNumber,
    referenceId: transaction.referenceId,
    balanceBefore: transaction.balanceBefore,
    balanceAfter: transaction.balanceAfter,
    status: transaction.status,
    createdAt: transaction.createdAt,
  };
}

async function listTransactions(userId, { page = 1, limit = 20 } = {}) {
  const [items, total] = await Promise.all([
    WalletTransaction.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WalletTransaction.countDocuments({ userId }),
  ]);
  return { items: items.map(toTransactionDTO), page, limit, total };
}

/** Compensation helper used only on standalone MongoDB (no transactions) when a later step fails. */
async function deleteByTransactionId(transactionId) {
  await WalletTransaction.deleteOne({ transactionId });
}

module.exports = { recordTransaction, listTransactions, toTransactionDTO, deleteByTransactionId };
