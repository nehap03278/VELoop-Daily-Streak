const { Wallet } = require('../models');

async function getOrCreateWallet(userId, session = null) {
  return Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, balances: { VES: 0, INR: 0 } } },
    { upsert: true, new: true, session }
  );
}

function toBalances(wallet) {
  return { VES: wallet.balances.VES, INR: wallet.balances.INR };
}

async function getBalances(userId) {
  return toBalances(await getOrCreateWallet(userId));
}

/**
 * Atomically credits the wallet with $inc and derives balanceBefore from the post-image,
 * so the ledger stays exact even when several credits happen at once.
 */
async function credit(userId, currency, amount, session = null) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { [`balances.${currency}`]: amount } },
    { new: true, upsert: true, session }
  );
  const balanceAfter = wallet.balances[currency];
  return { balanceBefore: balanceAfter - amount, balanceAfter, balances: toBalances(wallet) };
}

/** Compensation helper used only on standalone MongoDB (no transactions) when a later step fails. */
async function reverseCredit(userId, currency, amount) {
  await Wallet.updateOne({ userId }, { $inc: { [`balances.${currency}`]: -amount } });
}

module.exports = { getOrCreateWallet, getBalances, credit, reverseCredit, toBalances };
