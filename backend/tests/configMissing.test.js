/**
 * Reproduces the production incident: StreakConfig / StreakReward are the only two collections
 * populated exclusively by `seed/seed.js` (never run automatically on startup or by render.yaml).
 * If that seed never ran against a given database, the daily streak endpoints return 503
 * STREAK_NOT_CONFIGURED even though auth/wallet work fine - see streak.service.js loadState().
 */
const { request, createApp, setupDatabase, teardownDatabase, createUser, auth } = require('./helpers');
const { StreakReward, StreakConfig } = require('../src/models');
const { seedConfiguration } = require('../seed/seed');

let app;
beforeAll(async () => {
  await setupDatabase('configmissing');
  app = createApp();
});
afterAll(teardownDatabase);

describe('Missing streak configuration (unseeded database)', () => {
  test('status and daily-streak 503 once rewards are gone, but auth is still enforced first', async () => {
    const { token } = await createUser(app);

    await StreakReward.deleteMany({});
    await StreakConfig.deleteMany({});

    const status = await request(app).get('/api/daily-streak/status').set(auth(token)).expect(503);
    expect(status.body.error.code).toBe('STREAK_NOT_CONFIGURED');

    const full = await request(app).get('/api/daily-streak').set(auth(token)).expect(503);
    expect(full.body.error.code).toBe('STREAK_NOT_CONFIGURED');

    // Authorization is still checked before configuration - an invalid token still gets 401, not 503.
    await request(app).get('/api/daily-streak/status').expect(401);
    await request(app).get('/api/daily-streak').set(auth('garbage')).expect(401);
  });

  test('registration also fails once reward definitions are gone (register provisions the streak)', async () => {
    await StreakReward.deleteMany({});

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: `nouser_${Date.now()}@example.com`, password: 'Passw0rd!' })
      .expect(503);
    expect(res.body.error.code).toBe('STREAK_NOT_CONFIGURED');

    await seedConfiguration();
  });

  test('a config doc with no active rewards (non-contiguous days) is also rejected', async () => {
    const { token } = await createUser(app);
    await StreakReward.updateMany({}, { $set: { active: false } });
    await StreakReward.updateOne({ day: 1 }, { $set: { active: true } });
    await StreakReward.updateOne({ day: 3 }, { $set: { active: true } }); // day 2 missing: not contiguous

    const res = await request(app).get('/api/daily-streak/status').set(auth(token)).expect(503);
    expect(res.body.error.code).toBe('STREAK_NOT_CONFIGURED');

    await seedConfiguration();
  });

  test('re-running the seed restores both endpoints without touching existing users or wallets', async () => {
    const { token } = await createUser(app);
    const before = await request(app).get('/api/wallet').set(auth(token)).expect(200);

    await StreakReward.deleteMany({});
    await StreakConfig.deleteMany({});
    await request(app).get('/api/daily-streak/status').set(auth(token)).expect(503);

    await seedConfiguration();

    const status = await request(app).get('/api/daily-streak/status').set(auth(token)).expect(200);
    expect(status.body.streak).toMatchObject({ status: 'NEW', currentDay: 1 });

    const after = await request(app).get('/api/wallet').set(auth(token)).expect(200);
    expect(after.body.wallet.balances).toEqual(before.body.wallet.balances);
  });
});
