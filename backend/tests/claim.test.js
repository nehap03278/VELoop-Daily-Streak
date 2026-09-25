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
const { StreakClaim, WalletTransaction, AuditLog, StreakReward, StreakConfig, Wallet } = require('../src/models');

let app;
beforeAll(async () => {
  await setupDatabase('claim');
  app = createApp();
});
beforeEach(() => clock.setTestOffset(0));
afterAll(teardownDatabase);

describe('Initial state (Day 1)', () => {
  test('a new user sees Day 1 claimable and backend-provided rewards', async () => {
    const { token } = await createUser(app);
    const data = await getStreak(app, token);

    expect(data.serverTime).toEqual(expect.any(String));
    expect(data.streak).toMatchObject({ status: 'NEW', currentStreak: 0, currentDay: 1, checkedIn: 0, totalRewards: 7, claimable: true, nextClaimAt: null });
    expect(data.rewards.map((r) => r.status)).toEqual(['AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
    expect(data.rewards[0].isToday).toBe(true);
    expect(data.rewards.map((r) => r.reward.displayValue)).toEqual(['+5', '+10', '+15', '₹1', '₹2', '+30', '₹5']);
    expect(data.ultimateReward).toMatchObject({ day: 7, amount: 5, currency: 'INR', unlockDay: 7, assetType: 'crown', status: 'LOCKED' });
    expect(data.stats).toMatchObject({ totalRewards: 7, checkedIn: 0, nextReward: { day: 1, amount: 5, currency: 'VES' } });
    expect(data.cpa).toEqual({ required: true, durationSeconds: 5 });
  });
});

describe('Normal claim flow', () => {
  test('start -> CPA demo -> finalize grants the configured reward and records everything', async () => {
    const { token, user } = await createUser(app);

    const start = await startClaim(app, token).expect(202);
    expect(start.body.claimSession).toMatchObject({ day: 1, durationSeconds: 5 });
    // Starting a claim grants nothing.
    expect((await getStreak(app, token)).wallet.VES).toBe(0);

    // Finalizing before the server-side CPA timer elapsed is refused.
    const early = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(425);
    expect(early.body.error.code).toBe('CPA_NOT_COMPLETED');

    clock.advanceTestClock(6000);
    const done = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(200);
    expect(done.body).toMatchObject({
      idempotent: false,
      claim: { day: 1, cycleNumber: 1, status: 'COMPLETED' },
      transaction: { amount: 5, currency: 'VES', balanceBefore: 0, balanceAfter: 5, source: 'DAILY_STREAK' },
      wallet: { VES: 5, INR: 0 },
      streak: { currentStreak: 1 },
    });
    expect(done.body.claim.referenceId).toMatch(/^STREAK-[A-Z0-9]{8}$/);

    // Database integrity: claim -> reward -> transaction -> wallet are linked.
    const claim = await StreakClaim.findOne({ userId: user.id }).lean();
    const txn = await WalletTransaction.findOne({ transactionId: claim.transactionId }).lean();
    const reward = await StreakReward.findById(claim.rewardId).lean();
    expect(reward.day).toBe(1);
    expect(txn).toMatchObject({ referenceId: claim.referenceId, claimId: claim.claimId, streakDay: 1, amount: 5, balanceBefore: 0, balanceAfter: 5 });
    expect((await Wallet.findOne({ userId: user.id }).lean()).balances.VES).toBe(5);

    const events = (await AuditLog.find({ userId: user.id }).lean()).map((e) => e.event);
    expect(events).toEqual(expect.arrayContaining(['STREAK_CLAIM_REQUEST', 'STREAK_CLAIM_SUCCESS']));
  });

  test('after claiming, refreshed state shows Day 1 CLAIMED and Day 2 locked with a server countdown', async () => {
    const { token } = await createUser(app);
    const done = await claimToday(app, token).expect(200);
    const claimedAt = new Date(done.body.claim.claimedAt).getTime();

    const data = await getStreak(app, token);
    expect(data.streak).toMatchObject({ currentStreak: 1, currentDay: 2, checkedIn: 1, claimable: false, status: 'ACTIVE' });
    expect(new Date(data.streak.nextClaimAt).getTime()).toBe(claimedAt + 24 * HOUR);
    expect(data.rewards[0]).toMatchObject({ status: 'CLAIMED' });
    expect(data.rewards[0].claimedAt).toBeTruthy();
    expect(data.rewards[1]).toMatchObject({ status: 'LOCKED', isNext: true, unlocksAt: data.streak.nextClaimAt });
    expect(data.stats.nextReward).toMatchObject({ day: 2, amount: 10 });

    // The lightweight status endpoint agrees.
    const status = await request(app).get('/api/daily-streak/status').set(auth(token)).expect(200);
    expect(status.body.streak).toMatchObject({ currentDay: 2, claimable: false, nextClaimAt: data.streak.nextClaimAt });
  });

  test('locked reward cannot be claimed before the server says so', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);

    clock.advanceTestClock(23 * HOUR + 59 * 60 * 1000);
    const locked = await startClaim(app, token).expect(409);
    expect(locked.body.error).toMatchObject({ code: 'REWARD_LOCKED', message: 'Your next reward is not available yet.' });
    expect(locked.body.error.details.nextClaimAt).toBeTruthy();

    clock.advanceTestClock(2 * 60 * 1000);
    const next = await claimToday(app, token).expect(200);
    expect(next.body).toMatchObject({ claim: { day: 2 }, transaction: { amount: 10, balanceBefore: 5, balanceAfter: 15 } });
  });

  test('re-claiming an already claimed day is rejected', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    const again = await startClaim(app, token, { day: 1 }).expect(409);
    expect(again.body.error.code).toBe('ALREADY_CLAIMED');
    const events = (await AuditLog.find({ event: 'DUPLICATE_CLAIM' }).lean()).length;
    expect(events).toBeGreaterThan(0);
  });

  test('finalizing the same claim session twice is idempotent (reward granted once)', async () => {
    const { token } = await createUser(app);
    const start = await startClaim(app, token).expect(202);
    clock.advanceTestClock(6000);
    const first = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(200);
    const second = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(200);
    expect(first.body.idempotent).toBe(false);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.transaction.transactionId).toBe(first.body.transaction.transactionId);
    const data = await getStreak(app, token);
    expect(data.wallet.VES).toBe(5);
    expect(await WalletTransaction.countDocuments({ userId: data.user.id })).toBe(1);
  });

  test('finalize without a verification session is refused while CPA verification is required', async () => {
    const { token } = await createUser(app);
    const res = await finalizeClaim(app, token, {}).expect(400);
    expect(res.body.error.code).toBe('CPA_VERIFICATION_REQUIRED');
  });

  test('an abandoned claim session expires', async () => {
    const { token } = await createUser(app);
    const start = await startClaim(app, token).expect(202);
    clock.advanceTestClock(11 * 60 * 1000);
    const res = await finalizeClaim(app, token, { claimSessionId: start.body.claimSession.id }).expect(410);
    expect(res.body.error.code).toBe('CLAIM_SESSION_EXPIRED');
    // A fresh claim still works.
    await claimToday(app, token).expect(200);
  });

  test('refresh / logout-login returns the same persisted state', async () => {
    const { token, credentials } = await createUser(app);
    await claimToday(app, token).expect(200);
    const login = await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password }).expect(200);
    const fresh = await getStreak(app, login.body.token);
    expect(fresh.rewards[0].status).toBe('CLAIMED');
    expect(fresh.rewards[1].status).toBe('LOCKED');
    expect(fresh.streak.currentStreak).toBe(1);
  });

  test('history and wallet transactions reflect claims', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    const history = await request(app).get('/api/daily-streak/history').set(auth(token)).expect(200);
    expect(history.body.total).toBe(1);
    expect(history.body.claims[0]).toMatchObject({ day: 1, reward: { amount: 5, displayValue: '+5' } });
    expect(history.body.cycles[0]).toMatchObject({ cycleNumber: 1, status: 'ACTIVE', claimedDays: 1 });
    const txns = await request(app).get('/api/wallet/transactions').set(auth(token)).expect(200);
    expect(txns.body.items[0]).toMatchObject({ source: 'DAILY_STREAK', streakDay: 1, amount: 5 });
  });
});

describe('Backend-driven configuration', () => {
  afterEach(async () => {
    await StreakReward.updateOne({ day: 2, active: true }, { $set: { amount: 10, subtitle: '10 VEs' } });
    await StreakConfig.updateOne({ key: 'default' }, { $set: { claimIntervalMinutes: 1440, requireCpaVerification: true } });
  });

  test('changing a reward in the database changes what is shown and granted', async () => {
    await StreakReward.updateOne({ day: 2, active: true }, { $set: { amount: 15, subtitle: '15 VEs' } });
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    const data = await getStreak(app, token);
    expect(data.rewards[1].reward).toMatchObject({ amount: 15, displayValue: '+15', subtitle: '15 VEs' });
    clock.advanceTestClock(24 * HOUR);
    const res = await claimToday(app, token).expect(200);
    expect(res.body.transaction.amount).toBe(15);
  });

  test('claim interval comes from configuration', async () => {
    await StreakConfig.updateOne({ key: 'default' }, { $set: { claimIntervalMinutes: 60 } });
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(61 * 60 * 1000);
    await claimToday(app, token).expect(200);
  });

  test('CPA verification can be disabled by configuration (direct claim)', async () => {
    await StreakConfig.updateOne({ key: 'default' }, { $set: { requireCpaVerification: false } });
    const { token } = await createUser(app);
    const res = await startClaim(app, token).expect(200);
    expect(res.body).toMatchObject({ cpaRequired: false, claim: { day: 1 }, transaction: { amount: 5 } });
  });
});
