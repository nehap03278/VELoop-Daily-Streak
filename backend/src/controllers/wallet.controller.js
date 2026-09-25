const walletService = require('../services/wallet.service');
const transactionService = require('../services/transaction.service');
const clock = require('../utils/clock');

async function getWallet(req, res) {
  const balances = await walletService.getBalances(req.user._id);
  res.json({ success: true, serverTime: clock.now(), wallet: { balances } });
}

async function getTransactions(req, res) {
  const data = await transactionService.listTransactions(req.user._id, req.validated.query);
  res.json({ success: true, ...data });
}

module.exports = { getWallet, getTransactions };
