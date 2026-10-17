/**
 * Guards the two round-trip reductions made for production latency (streak.service.js loadState,
 * auth.service.js login): asserts behaviour is unchanged and the query-count optimisation holds,
 * rather than asserting on wall-clock time (which would be flaky).
 */
const { request, createApp, setupDatabase, teardownDatabase, createUser, auth, getStreak, clock, startClaim, finalizeClaim } = require('./helpers');
const { UserStreak, StreakConfig, AuditLog, User, ClaimSession } = require('../src/models');

let app;
beforeAll(async () => {
  await setupDatabase('perf');
  app = createApp();
});
afterAll(teardownDatabase);

describe('Performance: fewer round trips without behaviour changes', () => {
  test('loadState looks up an existing UserStreak only once (merged into the parallel batch)', async () => {
    const { token, user } = await createUser(app);
    await getStreak(app, token); // first access creates the streak/cycle

    const spy = jest.spyOn(UserStreak, 'findOne');
    const res = await request(app).get('/api/daily-streak/status').set(auth(token)).expect(200);

    expect(res.body.streak).toMatchObject({ status: 'NEW', currentDay: 1 });
    // A duplicate-read guard: a second, redundant findOne for this user would mean something
    // re-fetches the streak instead of reusing the batched result. This does NOT by itself prove
    // the read is parallel rather than sequential - see the timing test below for that.
    expect(spy.mock.calls.filter((args) => String(args[0]?.userId) === String(user.id))).toHaveLength(1);
    spy.mockRestore();
  });

  test('the UserStreak existence check starts alongside config/rewards, not after they resolve', async () => {
    const { token } = await createUser(app);
    await getStreak(app, token); // ensure the streak already exists (the fast path under test)

    const ARTIFICIAL_DELAY_MS = 200;
    const originalConfigFindOne = StreakConfig.findOne.bind(StreakConfig);
    const originalStreakFindOne = UserStreak.findOne.bind(UserStreak);
    let configCalledAt = null;
    let streakCalledAt = null;

    const configSpy = jest.spyOn(StreakConfig, 'findOne').mockImplementation((...args) => {
      configCalledAt = Date.now();
      const realQuery = originalConfigFindOne(...args);
      // Delay only the final resolution, well past when a parallel UserStreak.findOne would already
      // have been invoked, but small enough to keep the test fast.
      return { lean: () => new Promise((resolve, reject) => setTimeout(() => realQuery.lean().then(resolve, reject), ARTIFICIAL_DELAY_MS)) };
    });
    const streakSpy = jest.spyOn(UserStreak, 'findOne').mockImplementation((...args) => {
      if (streakCalledAt === null) streakCalledAt = Date.now();
      return originalStreakFindOne(...args);
    });

    await request(app).get('/api/daily-streak/status').set(auth(token)).expect(200);

    configSpy.mockRestore();
    streakSpy.mockRestore();

    expect(configCalledAt).not.toBeNull();
    expect(streakCalledAt).not.toBeNull();
    // If the existence check were sequenced after config/rewards (the old, unoptimised code),
    // it could only start once config's artificially delayed promise resolves - at least
    // ARTIFICIAL_DELAY_MS after configCalledAt. Running it in the same Promise.all batch means
    // it starts essentially immediately alongside config, well under that delay.
    expect(streakCalledAt - configCalledAt).toBeLessThan(ARTIFICIAL_DELAY_MS / 2);
  });

  test('a brand-new user (no UserStreak yet) still gets created correctly on first access', async () => {
    const { token } = await createUser(app);
    const data = await getStreak(app, token);
    expect(data.streak).toMatchObject({ status: 'NEW', currentDay: 1, currentStreak: 0 });
    expect(data.rewards).toHaveLength(7);
  });

  test('login still records lastLoginAt and a USER_LOGIN audit entry', async () => {
    const { credentials, user } = await createUser(app);
    const before = await User.findById(user.id);
    expect(before.lastLoginAt).toBeFalsy();

    await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password }).expect(200);

    const after = await User.findById(user.id);
    expect(after.lastLoginAt).toBeTruthy();

    const log = await AuditLog.findOne({ event: 'USER_LOGIN', userId: user.id });
    expect(log).toBeTruthy();
  });

  test('a failed user.save() during login still fails the request, not a silent success', async () => {
    const { credentials, user } = await createUser(app);
    const saveSpy = jest.spyOn(User.prototype, 'save').mockRejectedValueOnce(new Error('simulated save failure'));

    const res = await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password });

    saveSpy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body).not.toHaveProperty('token');

    // The save genuinely never persisted - lastLoginAt must still be unset.
    const after = await User.findById(user.id);
    expect(after.lastLoginAt).toBeFalsy();
  });
  test('a normal claim confirm validates and locks the session in one update (no separate lookup)', async () => {
    const { token, user } = await createUser(app);
    const start = await startClaim(app, token).expect(202);
    clock.advanceTestClock((start.body.claimSession.durationSeconds + 1) * 1000);

    const findSpy = jest.spyOn(ClaimSession, 'findOne');
    const res = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(200);
    expect(findSpy).not.toHaveBeenCalled();
    findSpy.mockRestore();

    expect(res.body.claim).toMatchObject({ day: 1 });
    const session = await ClaimSession.findOne({ sessionId: start.body.claimSession.id });
    expect(session.status).toBe('COMPLETED');
    // The request audit still lands even though it is no longer awaited before the work starts.
    expect(await AuditLog.countDocuments({ event: 'STREAK_CLAIM_REQUEST', userId: user.id })).toBe(2);
  });

  test('an early confirm still returns CPA_NOT_COMPLETED and leaves the session claimable', async () => {
    const { token } = await createUser(app);
    const start = await startClaim(app, token).expect(202);
    const early = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(425);
    expect(early.body.error.code).toBe('CPA_NOT_COMPLETED');

    clock.advanceTestClock((start.body.claimSession.durationSeconds + 1) * 1000);
    await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(200);
  });
});
