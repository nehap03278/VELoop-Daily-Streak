const {
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
} = require('./helpers');
const { AuditLog, StreakClaim, User, WalletTransaction } = require('../src/models');

let app;
beforeAll(async () => {
  await setupDatabase('security');
  app = createApp();
});
beforeEach(() => clock.setTestOffset(0));
afterAll(teardownDatabase);

describe('Anti-cheat: fake day', () => {
  test('requesting Day 7 while eligible for Day 2 is rejected', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(24 * HOUR);

    for (const day of [7, 5, 3]) {
      const res = await startClaim(app, token, { day }).expect(403);
      expect(res.body.error.code).toBe('DAY_NOT_ELIGIBLE');
    }
    const data = await getStreak(app, token);
    expect(data.streak.currentDay).toBe(2);
    expect(data.wallet.VES).toBe(5);
    expect(await AuditLog.countDocuments({ userId: data.user.id, event: 'INVALID_CLAIM' })).toBe(3);
  });

  test('a mismatching day in the finalize request is rejected', async () => {
    const { token } = await createUser(app);
    const start = await startClaim(app, token).expect(202);
    clock.advanceTestClock(6000);
    const res = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id, day: 7 }).expect(400);
    expect(res.body.error.code).toBe('DAY_MISMATCH');
  });

  test('query-string ?day=7 does not change the current day', async () => {
    const { token } = await createUser(app);
    const res = await request(app).get('/api/daily-streak?day=7').set(auth(token)).expect(200);
    expect(res.body.streak.currentDay).toBe(1);
    expect(res.body.rewards[6].status).toBe('LOCKED');
  });

  test('out-of-range and non-numeric days fail validation', async () => {
    const { token } = await createUser(app);
    expect((await startClaim(app, token, { day: 'abc' }).expect(400)).body.error.code).toBe('VALIDATION_ERROR');
    expect((await startClaim(app, token, { day: 99 }).expect(400)).body.error.code).toBe('VALIDATION_ERROR');
    expect((await startClaim(app, token, { day: 8 }).expect(400)).body.error.code).toBe('INVALID_DAY');
  });
});

describe('Anti-cheat: fake reward / streak values', () => {
  test('client supplied reward, amount, currency and streak are ignored', async () => {
    const { token } = await createUser(app);
    const tampered = { day: 1, reward: 1000000, amount: 100000, currency: 'INR', rewardType: 'GIFT_CARD', streak: 7, currentStreak: 7 };
    const res = await claimToday(app, token, tampered).expect(200);
    expect(res.body.transaction).toMatchObject({ amount: 5, currency: 'VES' });
    expect(res.body.streak.currentStreak).toBe(1);

    const data = await getStreak(app, token);
    expect(data.wallet).toEqual({ VES: 5, INR: 0 });
    expect(data.streak.currentStreak).toBe(1);
    const tamperLogs = await AuditLog.find({ userId: data.user.id, event: 'TAMPERED_REQUEST' }).lean();
    expect(tamperLogs.length).toBeGreaterThan(0);
    expect(tamperLogs[0].metadata.ignoredFields).toEqual(expect.arrayContaining(['reward', 'amount', 'currency', 'streak']));
  });
});

describe('Anti-cheat: fake user / cross-user access', () => {
  test('userId in the body is ignored - identity comes from the JWT', async () => {
    const alice = await createUser(app);
    const bob = await createUser(app);
    await claimToday(app, alice.token, { userId: bob.user.id }).expect(200);

    const aliceData = await getStreak(app, alice.token);
    const bobData = await getStreak(app, bob.token);
    expect(aliceData.wallet.VES).toBe(5);
    expect(bobData.wallet.VES).toBe(0);
    expect(bobData.streak.currentStreak).toBe(0);
    expect(await StreakClaim.countDocuments({ userId: bob.user.id })).toBe(0);
  });

  test("a user cannot finalize another user's claim session", async () => {
    const alice = await createUser(app);
    const bob = await createUser(app);
    const bobStart = await startClaim(app, bob.token).expect(202);
    clock.advanceTestClock(6000);
    const res = await finalizeClaim(app, alice.token, { claimSessionId: bobStart.body.claimSession.id }).expect(404);
    expect(res.body.error.code).toBe('CLAIM_SESSION_NOT_FOUND');
    expect((await getStreak(app, alice.token)).wallet.VES).toBe(0);
    expect((await getStreak(app, bob.token)).wallet.VES).toBe(0);
    // Bob can still complete his own claim.
    await finalizeClaim(app, bob.token, { claimSessionId: bobStart.body.claimSession.id }).expect(200);
  });

  test('history only ever contains the caller’s own claims', async () => {
    const alice = await createUser(app);
    const bob = await createUser(app);
    await claimToday(app, bob.token).expect(200);
    const res = await request(app).get(`/api/daily-streak/history?userId=${bob.user.id}`).set(auth(alice.token)).expect(200);
    expect(res.body.total).toBe(0);
  });
});

describe('Anti-cheat: device clock manipulation', () => {
  test('client time hints never unlock a reward early', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    const tomorrow = new Date(Date.now() + 25 * HOUR);
    const res = await request(app)
      .post('/api/daily-streak/claim/start')
      .set(auth(token))
      .set('Date', tomorrow.toUTCString())
      .set('X-Client-Time', tomorrow.toISOString())
      .send({ serverTime: tomorrow.toISOString(), nextClaimAt: new Date(0).toISOString() })
      .expect(409);
    expect(res.body.error.code).toBe('REWARD_LOCKED');
  });
});

describe('Account eligibility', () => {
  test('a suspended account cannot use the streak API', async () => {
    const { token, user } = await createUser(app);
    await User.updateOne({ _id: user.id }, { $set: { status: 'SUSPENDED' } });
    const res = await startClaim(app, token).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('Previous-day validation', () => {
  test('if the previous day is missing from the claim ledger the claim is rejected', async () => {
    const { token, user } = await createUser(app);
    await claimToday(app, token).expect(200);
    // Simulate a corrupted/inconsistent state: the counter says Day 1 was claimed but the ledger doesn't.
    await StreakClaim.deleteOne({ userId: user.id, day: 1 });
    clock.advanceTestClock(24 * HOUR);
    const res = await startClaim(app, token).expect(409);
    expect(res.body.error.code).toBe('PREVIOUS_DAY_NOT_CLAIMED');
  });
});

describe('Database constraints', () => {
  test('MongoDB itself refuses a duplicate (user, cycle, day) claim', async () => {
    const { token, user } = await createUser(app);
    await claimToday(app, token).expect(200);
    const existing = await StreakClaim.findOne({ userId: user.id }).lean();
    const { _id, claimId, ...rest } = existing;
    await expect(StreakClaim.create({ ...rest, claimId: 'CLM-DUPLICATE', claimSessionId: null })).rejects.toMatchObject({ code: 11000 });
  });

  test('MongoDB refuses a duplicate ledger reference', async () => {
    const { token } = await createUser(app);
    const res = await claimToday(app, token).expect(200);
    const txn = await WalletTransaction.findOne({ transactionId: res.body.transaction.transactionId }).lean();
    const { _id, ...rest } = txn;
    await expect(WalletTransaction.create({ ...rest, transactionId: 'TXN-OTHER' })).rejects.toMatchObject({ code: 11000 });
  });
});

describe('Error hygiene', () => {
  test('malformed JSON returns a clean error without internals', async () => {
    const { token } = await createUser(app);
    const res = await request(app)
      .post('/api/daily-streak/claim/start')
      .set(auth(token))
      .set('Content-Type', 'application/json')
      .send('{"day": 1,')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|stack|Mongo|CastError/);
  });

  test('invalid claim session ids are validated', async () => {
    const { token } = await createUser(app);
    const res = await finalizeClaim(app, token, { claimSessionId: { $ne: null } }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});
