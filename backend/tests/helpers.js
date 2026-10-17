process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-for-hs256-signing';

const mongoose = require('mongoose');
const request = require('supertest');
const { StreakConfig } = require('../src/models');
const { connectDB, disconnectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const clock = require('../src/utils/clock');
const { seedConfiguration } = require('../seed/seed');

const HOUR = 60 * 60 * 1000;

// Each test file gets its own database so files can never interfere with each other.
function testDbUri(name) {
  const url = new URL(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017');
  url.pathname = `/veloop_test_${name}`;
  return url.toString();
}

async function setupDatabase(name) {
  await connectDB(testDbUri(name));
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  await seedConfiguration();
  // The suites exercise the two-phase CPA flow; the direct claim path is covered explicitly in claim.test.js.
  await StreakConfig.updateOne({ key: 'default' }, { $set: { requireCpaVerification: true } });
}

async function teardownDatabase() {
  await mongoose.connection.db.dropDatabase();
  await disconnectDB();
}

let userCounter = 0;
async function createUser(app, overrides = {}) {
  userCounter += 1;
  const body = {
    name: overrides.name || `Tester ${userCounter}`,
    email: overrides.email || `tester${userCounter}_${Date.now()}@example.com`,
    password: overrides.password || 'Passw0rd!',
  };
  const res = await request(app).post('/api/auth/register').send(body).expect(201);
  return { token: res.body.token, user: res.body.user, credentials: body };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function getStreak(app, token) {
  const res = await request(app).get('/api/daily-streak').set(auth(token)).expect(200);
  return res.body;
}

function startClaim(app, token, body = {}) {
  return request(app).post('/api/daily-streak/claim/start').set(auth(token)).send(body);
}

function finalizeClaim(app, token, body) {
  return request(app).post('/api/daily-streak/claim').set(auth(token)).send(body);
}

/** Full happy-path claim: start -> (server clock passes the CPA demo) -> finalize. */
function claimToday(app, token, extraBody = {}) {
  const promise = (async () => {
    const start = await startClaim(app, token, extraBody);
    if (start.status !== 202) return start;
    clock.advanceTestClock((start.body.claimSession.durationSeconds + 1) * 1000);
    return finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id, ...extraBody });
  })();
  // supertest-like assertion that prints the response body on failure.
  promise.expect = async (status) => {
    const res = await promise;
    if (res.status !== status) throw new Error(`Expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
    return res;
  };
  return promise;
}

module.exports = {
  HOUR,
  request,
  createApp,
  clock,
  setupDatabase,
  teardownDatabase,
  createUser,
  auth,
  getStreak,
  startClaim,
  finalizeClaim,
  claimToday,
};
