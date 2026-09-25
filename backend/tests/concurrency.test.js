const {
  HOUR,
  createApp,
  clock,
  setupDatabase,
  teardownDatabase,
  createUser,
  getStreak,
  startClaim,
  finalizeClaim,
  claimToday,
} = require('./helpers');
const { StreakClaim, WalletTransaction } = require('../src/models');

let app;
beforeAll(async () => {
  await setupDatabase('concurrency');
  app = createApp();
});
beforeEach(() => clock.setTestOffset(0));
afterAll(teardownDatabase);

async function expectSingleGrant(token, expectedVES) {
  const data = await getStreak(app, token);
  expect(data.wallet.VES).toBe(expectedVES);
  const userId = data.user.id;
  const claims = await StreakClaim.find({ userId }).lean();
  const days = claims.map((c) => `${c.cycleNumber}:${c.day}`);
  expect(new Set(days).size).toBe(days.length);
  expect(await WalletTransaction.countDocuments({ userId, source: 'DAILY_STREAK' })).toBe(claims.length);
  return data;
}

describe('Concurrent claim protection', () => {
  test('10 simultaneous finalize calls with the same session grant exactly once', async () => {
    const { token } = await createUser(app);
    const start = await startClaim(app, token).expect(202);
    clock.advanceTestClock(6000);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }))
    );
    const granted = results.filter((r) => r.status === 200 && r.body.idempotent === false);
    expect(granted).toHaveLength(1);
    results.forEach((r) => expect([200, 409]).toContain(r.status));
    await expectSingleGrant(token, 5);
  });

  test('multiple tabs: separate sessions for the same day, finalized simultaneously, grant exactly once', async () => {
    const { token } = await createUser(app);
    const sessions = await Promise.all(Array.from({ length: 5 }, () => startClaim(app, token)));
    sessions.forEach((s) => expect(s.status).toBe(202));
    clock.advanceTestClock(6000);

    const results = await Promise.all(
      sessions.map((s) => finalizeClaim(app, token, { claimSessionId: s.body.claimSession.id }))
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    results
      .filter((r) => r.status !== 200)
      .forEach((r) => expect(['ALREADY_CLAIMED', 'CLAIM_CONFLICT']).toContain(r.body.error.code));
    await expectSingleGrant(token, 5);
  });

  test('tab B cannot claim after tab A already claimed (sequential)', async () => {
    const { token } = await createUser(app);
    const tabA = await startClaim(app, token).expect(202);
    const tabB = await startClaim(app, token).expect(202);
    clock.advanceTestClock(6000);
    await finalizeClaim(app, token, { claimSessionId: tabA.body.claimSession.id }).expect(200);
    const res = await finalizeClaim(app, token, { claimSessionId: tabB.body.claimSession.id }).expect(409);
    expect(res.body.error.code).toBe('ALREADY_CLAIMED');
    await expectSingleGrant(token, 5);
  });

  test('concurrent Day 2 claims after the timer grant +10 once, not +20', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(24 * HOUR);

    const [a, b] = await Promise.all([startClaim(app, token), startClaim(app, token)]);
    clock.advanceTestClock(6000);
    const results = await Promise.all([
      finalizeClaim(app, token, { claimSessionId: a.body.claimSession.id }),
      finalizeClaim(app, token, { claimSessionId: b.body.claimSession.id }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    await expectSingleGrant(token, 15);
  });

  test('concurrent first requests create exactly one streak record for a user', async () => {
    const { token } = await createUser(app);
    const results = await Promise.all(Array.from({ length: 8 }, () => getStreak(app, token)));
    results.forEach((r) => expect(r.streak.currentDay).toBe(1));
  });
});
