const mongoose = require('mongoose');
const env = require('./env');

let transactionsSupported = false;

async function connectDB(uri = env.MONGO_URI, { requireTransactions = env.REQUIRE_TRANSACTIONS } = {}) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 10000 });

  // Multi-document transactions require a replica set or sharded cluster (MongoDB Atlas always is one).
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  transactionsSupported = Boolean(hello.setName) || hello.msg === 'isdbgrid';

  // The standalone rollback path is for local development only; never let it become the production path.
  if (requireTransactions && !transactionsSupported) {
    await mongoose.disconnect();
    throw new Error(
      'MongoDB transactions are required but this deployment is a standalone server. Use MongoDB Atlas or a replica set ' +
        '(or set REQUIRE_TRANSACTIONS=false for local development only).'
    );
  }

  // Make sure unique / partial indexes exist before any request is served — they are part of the
  // duplicate-claim protection, not just a performance optimisation.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

function supportsTransactions() {
  return transactionsSupported;
}

module.exports = { connectDB, disconnectDB, supportsTransactions };
