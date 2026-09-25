const { evaluate, buildDayStates } = require('../src/utils/streakCalculator');

const HOUR = 60 * 60 * 1000;
const config = { claimIntervalMinutes: 24 * 60, claimWindowMinutes: 24 * 60 };
const T0 = new Date('2026-09-05T10:00:00.000Z');
const at = (hours) => new Date(T0.getTime() + hours * HOUR);
const streak = (overrides) => ({ currentStreak: 0, lastClaimedDay: 0, lastClaimAt: null, cycleNumber: 1, ...overrides });
const rewards = Array.from({ length: 7 }, (_, index) => ({ day: index + 1 }));

describe('streakCalculator.evaluate', () => {
  test('new user: Day 1 is immediately claimable', () => {
    const result = evaluate(streak(), config, 7, T0);
    expect(result).toMatchObject({ currentDay: 1, claimable: true, missed: false, unlockAt: null, deadline: null });
  });

  test('after a claim the next day is locked until the configured interval passes', () => {
    const s = streak({ currentStreak: 1, lastClaimedDay: 1, lastClaimAt: T0 });
    expect(evaluate(s, config, 7, at(23.99))).toMatchObject({ currentDay: 2, claimable: false, missed: false });
    expect(evaluate(s, config, 7, at(24))).toMatchObject({ currentDay: 2, claimable: true, missed: false });
    expect(evaluate(s, config, 7, at(24)).unlockAt.toISOString()).toBe(at(24).toISOString());
  });

  test('streak is missed only once the claim window after unlock has passed', () => {
    const s = streak({ currentStreak: 2, lastClaimedDay: 2, lastClaimAt: T0 });
    expect(evaluate(s, config, 7, at(47.99)).missed).toBe(false);
    const missed = evaluate(s, config, 7, at(48));
    expect(missed).toMatchObject({ missed: true, missedDay: 3, claimable: false });
  });

  test('a reset streak (0) is never "missed" again', () => {
    const s = streak({ currentStreak: 0, lastClaimedDay: 0, lastClaimAt: T0 });
    expect(evaluate(s, config, 7, at(500))).toMatchObject({ missed: false, claimable: true, currentDay: 1 });
  });

  test('completed cycle rolls over to Day 1 of the next cycle', () => {
    const s = streak({ currentStreak: 7, lastClaimedDay: 7, lastClaimAt: T0, cycleNumber: 3 });
    expect(evaluate(s, config, 7, at(1))).toMatchObject({ currentDay: 1, cycleComplete: true, needsNewCycle: true, targetCycleNumber: 4, claimable: false });
    expect(evaluate(s, config, 7, at(24)).claimable).toBe(true);
  });

  test('intervals come from configuration, not constants', () => {
    const s = streak({ currentStreak: 1, lastClaimedDay: 1, lastClaimAt: T0 });
    const fast = { claimIntervalMinutes: 60, claimWindowMinutes: 30 };
    expect(evaluate(s, fast, 7, at(1)).claimable).toBe(true);
    expect(evaluate(s, fast, 7, at(1.5)).missed).toBe(true);
  });
});

describe('streakCalculator.buildDayStates', () => {
  test('claimed / available / locked states', () => {
    const s = streak({ currentStreak: 2, lastClaimedDay: 2, lastClaimAt: T0 });
    const states = buildDayStates({ evaluation: evaluate(s, config, 7, at(25)), rewards, claimsByDay: new Map() });
    expect(states.map((d) => d.status)).toEqual(['CLAIMED', 'CLAIMED', 'AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
    expect(states[2].isToday).toBe(true);
  });

  test('the next day carries its unlock time while waiting', () => {
    const s = streak({ currentStreak: 1, lastClaimedDay: 1, lastClaimAt: T0 });
    const states = buildDayStates({ evaluation: evaluate(s, config, 7, at(2)), rewards, claimsByDay: new Map() });
    expect(states[1]).toMatchObject({ status: 'LOCKED', isNext: true });
    expect(states[1].unlocksAt.toISOString()).toBe(at(24).toISOString());
  });

  test('a completed cycle stays fully claimed until the next cycle unlocks', () => {
    const s = streak({ currentStreak: 7, lastClaimedDay: 7, lastClaimAt: T0 });
    const waiting = buildDayStates({ evaluation: evaluate(s, config, 7, at(3)), rewards, claimsByDay: new Map() });
    expect(waiting.every((d) => d.status === 'CLAIMED')).toBe(true);
    const next = buildDayStates({ evaluation: evaluate(s, config, 7, at(25)), rewards, claimsByDay: new Map() });
    expect(next.map((d) => d.status)).toEqual(['AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
  });
});
