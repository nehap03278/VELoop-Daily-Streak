import { api } from './apiClient';

// The API host can sleep when idle and take up to a minute to wake, so auth calls get a longer timeout.
const WAKE_TIMEOUT_MS = 60000;

/** Fire-and-forget ping that wakes a sleeping API host while the user is still typing. */
export function wakeServer() {
  return api.get('/health', { timeout: WAKE_TIMEOUT_MS }).catch(() => {});
}

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials, { timeout: WAKE_TIMEOUT_MS });
  return data;
}

export async function register(details) {
  const { data } = await api.post('/auth/register', details, { timeout: WAKE_TIMEOUT_MS });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
