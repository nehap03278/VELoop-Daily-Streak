const env = require('./config/env');
require('./models');
const { connectDB, supportsTransactions } = require('./config/db');
const { createApp } = require('./app');

async function start() {
  await connectDB();
  console.log(`[db] connected (multi-document transactions: ${supportsTransactions() ? 'enabled' : 'unavailable - using atomic ops + compensation'})`);

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[api] VELoop Daily Streak API listening on port ${env.PORT} (${env.NODE_ENV})`);
    if (env.ENABLE_DEV_TOOLS) console.warn('[api] DEV TOOLS ENABLED - /api/dev/* routes are mounted (local development only).');
    if (env.isProduction && env.DEV_TOOLS_REQUESTED) console.warn('[api] ENABLE_DEV_TOOLS is ignored in production; /api/dev/* is NOT mounted.');
    if (env.isProduction && env.TRUST_PROXY === false) console.warn('[api] TRUST_PROXY is not set - behind a proxy all clients would share one rate-limit bucket.');
  });
}

start().catch((error) => {
  console.error('[api] failed to start:', error);
  process.exit(1);
});
