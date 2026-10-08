/**
 * Spec section 29: backend-decided card states (LOCKED, AVAILABLE, TODAY, CLAIMED, MISSED).
 * `state` is the display classification; `status` remains the claimability flag used for claiming.
 */
const { evaluate, buildDayStates, DAY_STATES } = require('../src/utils/streakCalculator');
const {
  HOUR,
  createApp,
  clock,
  setupDatabase,
  teardownDatabase,
  createUser,
  getStreak,
  claimToday,
} = require('./helpers');

const config = { claimIntervalMinutes: 24 * 60, claimWindowMinutes: 24 * 60 };
const T0 = new Date('2026-09-05T10:00:00.000Z');
const at = (hours) => new Date(T0.getTime() + hours * HOUR);
const rewards = Array.from({ length: 7 }, (_, index) => ({ day: index + 1 }));
const streak = (overrides) => ({ currentStreak: 0, lastClaimedDay: 0, lastClaimAt: null, cycleNumber: 1, ...overrides });
const statesOf = (cards) => cards.map((card) => card.state);

describe('buildDayStates - explicit card state', () => {
  test('the claimable current day is state TODAY (status stays AVAILABLE)', () => {
    const cards = buildDayStates({ evaluation: evaluate(streak(), config, 7, T0), rewards, claimsByDay: new Map() });
    expect(cards[0]).toMatchObject({ state: 'TODAY', status: 'AVAILABLE', isToday: true });
    expect(statesOf(cards).slice(1)).toEqual(Array(6).fill('LOCKED'));
  });

  test('claimed days are CLAIMED and the waiting day is LOCKED', () => {
    const s = streak({ currentStreak: 1, lastClaimedDay: 1, lastClaimAt: T0 });
    const cards = buildDayStates({ evaluation: evaluate(s, config, 7, at(2)), rewards, claimsByDay: new Map() });
    expect(statesOf(cards)).toEqual(['CLAIMED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
    expect(cards[1]).toMatchObject({ status: 'LOCKED', isNext: true });
  });

  test('the missed day from an active reset is MISSED and not claimable', () => {
    const s = streak({ currentStreak: 0, lastClaimedDay: 0, lastClaimAt: T0 });
    const cards = buildDayStates({ evaluation: evaluate(s, config, 7, at(60)), rewards, claimsByDay: new Map(), missedDay: 3 });
    expect(statesOf(cards)).toEqual(['TODAY', 'LOCKED', 'MISSED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
    expect(cards[2].status).toBe('LOCKED');
  });

  test("TODAY wins when the missed day is also today's claimable day (Day 1)", () => {
    const s = streak({ currentStreak: 0, lastClaimedDay: 0, lastClaimAt: T0 });
    const cards = buildDayStates({ evaluation: evaluate(s, config, 7, at(60)), rewards, claimsByDay: new Map(), missedDay: 1 });
    expect(cards[0]).toMatchObject({ state: 'TODAY', status: 'AVAILABLE' });
    expect(statesOf(cards)).not.toContain('MISSED');
  });

  test('every emitted state belongs to the documented set', () => {
    const s = streak({ currentStreak: 2, lastClaimedDay: 2, lastClaimAt: T0 });
    const cards = buildDayStates({ evaluation: evaluate(s, config, 7, at(25)), rewards, claimsByDay: new Map(), missedDay: 5 });
    cards.forEach((card) => expect(DAY_STATES).toContain(card.state));
  });
});

describe('GET /api/daily-streak - card state in the API response', () => {
  let app;
  beforeAll(async () => {
    await setupDatabase('cardstate');
    app = createApp();
  });
  beforeEach(() => clock.setTestOffset(0));
  afterAll(teardownDatabase);

  test('a new user gets Day 1 as TODAY', async () => {
    const { token } = await createUser(app);
    const data = await getStreak(app, token);
    expect(data.rewards[0]).toMatchObject({ day: 1, state: 'TODAY', status: 'AVAILABLE' });
    expect(data.rewards.slice(1).every((card) => card.state === 'LOCKED')).toBe(true);
    expect(data.ultimateReward.state).toBe('LOCKED');
  });

  test('after a claim: Day 1 CLAIMED, Day 2 LOCKED; after the interval Day 2 becomes TODAY', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    let data = await getStreak(app, token);
    expect(data.rewards.slice(0, 2).map((card) => card.state)).toEqual(['CLAIMED', 'LOCKED']);

    clock.advanceTestClock(24 * HOUR);
    data = await getStreak(app, token);
    expect(data.rewards[1]).toMatchObject({ state: 'TODAY', status: 'AVAILABLE' });
  });

  test('after a missed day the missed card is MISSED until the next claim', async () => {
    const { token } = await createUser(app);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(24 * HOUR);
    await claimToday(app, token).expect(200);
    clock.advanceTestClock(48 * HOUR + 1000);

    let data = await getStreak(app, token);
    expect(data.resetNotice.missedDay).toBe(3);
    expect(data.rewards.map((card) => card.state)).toEqual(['TODAY', 'LOCKED', 'MISSED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
    expect(data.rewards[2].status).toBe('LOCKED');

    await claimToday(app, token).expect(200);
    data = await getStreak(app, token);
    expect(data.resetNotice).toBeNull();
    expect(data.rewards.map((card) => card.state)).not.toContain('MISSED');
    expect(data.rewards[0].state).toBe('CLAIMED');
  });
});
