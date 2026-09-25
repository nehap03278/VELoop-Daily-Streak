/**
 * Production-safety guards: configuration defaults and the "transactions required" startup check.
 * env.js is re-evaluated in isolation for each scenario so the real process env is untouched.
 */
const { setupDatabase, teardownDatabase } = require('./helpers');

const ORIGINAL_ENV = { ...process.env };

function loadEnv(overrides) {
  process.env = { ...ORIGINAL_ENV };
  // Ignore the developer's local backend/.env for these scenarios.
  for (const key of ['NODE_ENV', 'MONGO_URI', 'JWT_SECRET', 'CLIENT_URL', 'ENABLE_DEV_TOOLS', 'TRUST_PROXY', 'REQUIRE_TRANSACTIONS']) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);
  let env;
  jest.isolateModules(() => {
    jest.doMock('dotenv', () => ({ config: () => ({}) }));
    env = require('../src/config/env');
  });
  return env;
}

const PROD = {
  MONGO_URI: 'mongodb+srv://user:pass@cluster.example.net/veloop',
  JWT_SECRET: 'x'.repeat(48),
  CLIENT_URL: 'https://veloop-streak.vercel.app/',
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.dontMock('dotenv');
});

describe('Production configuration guards', () => {
  test('an unset NODE_ENV is treated as production (no insecure fallbacks)', () => {
    expect(() => loadEnv({})).toThrow(/Missing required environment variable: MONGO_URI/);
    expect(() => loadEnv({ MONGO_URI: PROD.MONGO_URI })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ MONGO_URI: PROD.MONGO_URI, JWT_SECRET: PROD.JWT_SECRET })).toThrow(/CLIENT_URL/);
  });

  test('short JWT secrets are refused in production', () => {
    expect(() => loadEnv({ ...PROD, JWT_SECRET: 'short' })).toThrow(/at least 32 characters/);
  });

  test('dev tools can never be enabled in production', () => {
    const env = loadEnv({ ...PROD, NODE_ENV: 'production', ENABLE_DEV_TOOLS: 'true' });
    expect(env.ENABLE_DEV_TOOLS).toBe(false);
    expect(loadEnv({ ...PROD, ENABLE_DEV_TOOLS: 'true' }).ENABLE_DEV_TOOLS).toBe(false); // NODE_ENV unset
    expect(loadEnv({ NODE_ENV: 'development', ENABLE_DEV_TOOLS: 'true' }).ENABLE_DEV_TOOLS).toBe(true);
  });

  test('transactions are required by default in production only', () => {
    expect(loadEnv({ ...PROD, NODE_ENV: 'production' }).REQUIRE_TRANSACTIONS).toBe(true);
    expect(loadEnv({ NODE_ENV: 'development' }).REQUIRE_TRANSACTIONS).toBe(false);
  });

  test('CORS origins are normalised and proxy hops parsed', () => {
    const env = loadEnv({ ...PROD, CLIENT_URL: 'https://a.example.com/, https://b.example.com', TRUST_PROXY: 'true' });
    expect(env.ALLOWED_ORIGINS).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(env.TRUST_PROXY).toBe(1);
    expect(loadEnv({ ...PROD, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    expect(loadEnv({ ...PROD }).TRUST_PROXY).toBe(false);
  });
});

describe('Transaction requirement at startup', () => {
  afterAll(teardownDatabase);

  test('connectDB refuses a deployment without transactions when they are required', async () => {
    await setupDatabase('prodconfig');
    const { connectDB, disconnectDB, supportsTransactions } = require('../src/config/db');
    const hasTransactions = supportsTransactions();
    const mongoose = require('mongoose');
    const uri = mongoose.connection.client.s.url;
    await disconnectDB();

    if (hasTransactions) {
      // Replica set / Atlas: the production path starts normally with transactions enabled.
      await expect(connectDB(uri, { requireTransactions: true })).resolves.toBeTruthy();
      expect(supportsTransactions()).toBe(true);
    } else {
      // Standalone: the rollback path must not silently become the production path.
      await expect(connectDB(uri, { requireTransactions: true })).rejects.toThrow(/transactions are required/);
      await connectDB(uri, { requireTransactions: false });
    }
  });
});
