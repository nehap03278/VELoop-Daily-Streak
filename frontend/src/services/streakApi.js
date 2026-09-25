import { api } from './apiClient';

/**
 * Centralised Daily Streak API. Components never call axios directly.
 * Every function returns backend data untouched - the frontend never computes streak state itself.
 */

/** Full page state. `timing` lets the UI anchor the server clock to the monotonic browser clock. */
export async function getStreak() {
  const requestedAt = performance.now();
  const { data } = await api.get('/daily-streak');
  return { data, timing: { requestedAt, receivedAt: performance.now() } };
}

export async function getStatus() {
  const requestedAt = performance.now();
  const { data } = await api.get('/daily-streak/status');
  return { data, timing: { requestedAt, receivedAt: performance.now() } };
}

/** Phase 1: the backend validates eligibility and opens a CPA verification session. No day/reward is sent. */
export async function startClaim() {
  const { data } = await api.post('/daily-streak/claim/start', {});
  return data;
}

/** Phase 2: after the CPA demo, the backend re-validates and grants the reward (idempotent per session). */
export async function confirmClaim(claimSessionId) {
  const { data } = await api.post('/daily-streak/claim', { claimSessionId });
  return data;
}

export async function getHistory({ page = 1, limit = 20 } = {}) {
  const { data } = await api.get('/daily-streak/history', { params: { page, limit } });
  return data;
}
