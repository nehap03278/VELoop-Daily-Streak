const mongoose = require('mongoose');
const { supportsTransactions } = require('../config/db');

/**
 * Runs `work(session)` inside a MongoDB multi-document transaction when the deployment supports it
 * (replica set / Atlas). On a standalone server `session` is null and the caller's atomic operations,
 * unique indexes and compensation logic provide the integrity guarantees instead.
 */
async function runInTransaction(work) {
  if (!supportsTransactions()) return work(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { runInTransaction };
