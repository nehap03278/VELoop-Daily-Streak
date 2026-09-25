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
const { StreakCycle, AuditLog } = require('../src/models');

let app;
beforeAll(async () => {
  await setupDatabase('missed');
  app = createApp();
});
beforeEach(() => clock.setTestOffset(0));
afterAll(teardownDatabase);

describe('Missed-day detection and reset', () => {
  test('Day 1 + Day 2 claimed, Day 3 missed -> backend resets to Day 1', async () => {
    const { token, user } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(24 * HOUR);
    await claimToday(app, token).expect(200);

    // Advance server time past the Day 3 claim window (24h lock + 24h window).
    clock.advanceTestClock(48 * HOUR + 1000);
    const data = await getStreak(app, token);

    expect(data.streak).toMatchObject({ status: 'RESET', currentStreak: 0, currentDay: 1, checkedIn: 0, claimable: true });
    expect(data.rewards[0]).toMatchObject({ status: 'AVAILABLE', isToday: true });
    expect(data.resetNotice).toMatchObject({ missedDay: 3, previousStreak: 2, claimedDays: 2 });
    expect(data.resetNotice.days.map((d) => d.status)).toEqual(['CLAIMED', 'CLAIMED', 'MISSED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);

    const cycles = await StreakCycle.find({ userId: user.id }).sort({ cycleNumber: 1 }).lean();
    expect(cycles.map((c) => [c.cycleNumber, c.status])).toEqual([[1, 'BROKEN'], [2, 'ACTIVE']]);
    expect(cycles[0].missedDay).toBe(3);
    expect(await AuditLog.countDocuments({ userId: user.id, event: 'STREAK_RESET' })).toBe(1);

    // Reading again does not reset twice.
    await getStreak(app, token);
    expect(await AuditLog.countDocuments({ userId: user.id, event: 'STREAK_RESET' })).toBe(1);

    // Day 1 of the new cycle can be claimed; the notice disappears.
    const res = await claimToday(app, token).expect(200);
    expect(res.body.claim).toMatchObject({ day: 1, cycleNumber: 2 });
    const after = await getStreak(app, token);
    expect(after.resetNotice).toBeNull();
    expect(after.streak).toMatchObject({ currentStreak: 1, currentDay: 2, status: 'ACTIVE' });
    expect(after.streak.longestStreak).toBe(2);
  });

  test('status endpoint also detects the missed day (not just the full page)', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(72 * HOUR);
    const res = await request(app).get('/api/daily-streak/status').set(auth(token)).expect(200);
    expect(res.body.streak).toMatchObject({ status: 'RESET', currentStreak: 0, currentDay: 1 });
  });

  test('claiming inside the window keeps the streak even if the user was away (browser closed)', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(47 * HOUR);
    const data = await getStreak(app, token);
    expect(data.streak).toMatchObject({ currentStreak: 1, currentDay: 2, claimable: true });
    await claimToday(app, token).expect(200);
    expect((await getStreak(app, token)).streak.currentStreak).toBe(2);
  });

  test('a claim attempted after the window passed is rejected with STREAK_RESET, then Day 1 works', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(49 * HOUR);
    const res = await startClaim(app, token).expect(409);
    expect(res.body.error).toMatchObject({ code: 'STREAK_RESET', message: 'Your streak has been reset. Start again from Day 1.' });
    const next = await claimToday(app, token).expect(200);
    expect(next.body.claim.day).toBe(1);
  });

  test('a claim session opened before a reset cannot be used after it', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(47.9 * HOUR);
    const start = await startClaim(app, token).expect(202);
    clock.advanceTestClock(0.12 * HOUR); // the window passes while the session is still valid
    const res = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id });
    expect(res.status).toBe(409);
    expect(['STREAK_RESET', 'CLAIM_SESSION_STALE']).toContain(res.body.error.code);
    expect((await getStreak(app, token)).wallet.VES).toBe(5);
  });
});

describe('Full 7-day cycle', () => {
  test('completing Day 7 finishes the cycle and a new one starts after the interval', async () => {
    const { token, user } = await createUser(app);
    for (let day = 1; day <= 7; day += 1) {
      const res = await claimToday(app, token).expect(200);
      expect(res.body.claim.day).toBe(day);
      clock.advanceTestClock(24 * HOUR);
      if (day === 7) clock.advanceTestClock(-24 * HOUR);
    }

    let data = await getStreak(app, token);
    expect(data.wallet).toEqual({ VES: 5 + 10 + 15 + 30, INR: 1 + 2 + 5 });
    expect(data.streak).toMatchObject({ currentStreak: 7, cycleCompleted: true, checkedIn: 7, claimable: false });
    expect(data.rewards.every((r) => r.status === 'CLAIMED')).toBe(true);
    expect(data.ultimateReward.status).toBe('CLAIMED');
    expect(data.stats.nextReward.day).toBe(1);

    clock.advanceTestClock(24 * HOUR);
    data = await getStreak(app, token);
    expect(data.streak).toMatchObject({ currentDay: 1, cycleNumber: 2, cycleCompleted: false, claimable: true, checkedIn: 0 });

    const res = await claimToday(app, token).expect(200);
    expect(res.body.claim).toMatchObject({ day: 1, cycleNumber: 2 });
    expect(res.body.streak.currentStreak).toBe(8);

    const cycles = await StreakCycle.find({ userId: user.id }).sort({ cycleNumber: 1 }).lean();
    expect(cycles.map((c) => [c.cycleNumber, c.status, c.claimedDays])).toEqual([
      [1, 'COMPLETED', 7],
      [2, 'ACTIVE', 1],
    ]);
  });

  test('missing Day 1 of the next cycle after completion resets the streak count', async () => {
    const { token } = await createUser(app);
    for (let day = 1; day <= 7; day += 1) {
      await claimToday(app, token).expect(200);
      if (day < 7) clock.advanceTestClock(24 * HOUR);
    }
    clock.advanceTestClock(49 * HOUR);
    const data = await getStreak(app, token);
    expect(data.streak).toMatchObject({ currentStreak: 0, currentDay: 1, status: 'RESET', claimable: true });
    expect(data.streak.longestStreak).toBe(7);
  });
});
