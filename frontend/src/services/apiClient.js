import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const TOKEN_KEY = 'veloop.authToken';

/** Only the auth token is stored client-side. No streak/reward/wallet value is ever persisted in the browser. */
export const tokenStore = {
  get() {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) - session lasts for this tab only */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const UNAUTHORIZED_EVENT = 'veloop:unauthorized';

export class ApiError extends Error {
  constructor({ code, message, status, details }) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Friendly copy for failures that don't carry a safe server message.
const FALLBACK_MESSAGES = {
  NETWORK_ERROR: 'Unable to reach VELoop right now. Check your connection and try again.',
  TIMEOUT: 'VELoop is taking too long to respond. Please try again.',
  INTERNAL_ERROR: 'Unable to process your reward. Please try again.',
};

/** Converts any axios failure into an ApiError with a user-safe message (never AxiosError/Mongo internals). */
export function toApiError(error) {
  if (error instanceof ApiError) return error;
  const payload = error?.response?.data?.error;
  if (payload && payload.code) {
    const message = payload.code === 'INTERNAL_ERROR' ? FALLBACK_MESSAGES.INTERNAL_ERROR : payload.message;
    return new ApiError({ code: payload.code, message, status: error.response.status, details: payload.details });
  }
  if (error?.code === 'ECONNABORTED') return new ApiError({ code: 'TIMEOUT', message: FALLBACK_MESSAGES.TIMEOUT });
  if (error?.response) {
    return new ApiError({ code: 'INTERNAL_ERROR', message: FALLBACK_MESSAGES.INTERNAL_ERROR, status: error.response.status });
  }
  return new ApiError({ code: 'NETWORK_ERROR', message: FALLBACK_MESSAGES.NETWORK_ERROR });
}

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    if (apiError.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(apiError);
  }
);
