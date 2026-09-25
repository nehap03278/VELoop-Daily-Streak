import { api } from './apiClient';

export async function getWallet() {
  const { data } = await api.get('/wallet');
  return data.wallet;
}

export async function getTransactions({ page = 1, limit = 10 } = {}) {
  const { data } = await api.get('/wallet/transactions', { params: { page, limit } });
  return data;
}

/** QA-only helpers (backend must run with ENABLE_DEV_TOOLS=true). They only affect the caller's own account. */
export async function devTimeTravel(hours) {
  const { data } = await api.post('/dev/time-travel', { hours });
  return data;
}

export async function devResetMyStreak() {
  const { data } = await api.post('/dev/reset-my-streak', {});
  return data;
}
