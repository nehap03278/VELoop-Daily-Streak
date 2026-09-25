import { useCallback, useEffect, useRef, useState } from 'react';
import { getStreak } from '../services/streakApi';
import { createServerClock } from '../utils/serverClock';

const CHANNEL_NAME = 'veloop-daily-streak';
const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

/**
 * Loads the Daily Streak state from the backend and keeps it fresh.
 * The response is rendered as-is: no streak, day, reward or eligibility value is derived in the browser.
 */
export function useDailyStreak() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [serverNow, setServerNow] = useState(null);
  const inflightRef = useRef(null);
  const channelRef = useRef(null);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    if (inflightRef.current) return inflightRef.current;
    const request = (async () => {
      try {
        const { data: next, timing } = await getStreak();
        if (!mountedRef.current) return null;
        setServerNow(() => createServerClock(next.serverTime, timing));
        setData(next);
        setError(null);
        setStatus('ready');
        return next;
      } catch (err) {
        if (!mountedRef.current) return null;
        setError(err);
        // Keep showing the last good backend state if we have one; otherwise show the error screen.
        setStatus((previous) => (previous === 'ready' ? 'ready' : 'error'));
        return null;
      } finally {
        inflightRef.current = null;
      }
    })();
    inflightRef.current = request;
    return request;
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    return load();
  }, [load]);

  /** Tell other open tabs that the streak changed so they re-fetch (the backend still blocks double claims). */
  const notifyOtherTabs = useCallback(() => {
    try {
      channelRef.current?.postMessage({ type: 'streak-changed' });
    } catch {
      /* BroadcastChannel unsupported */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();

    if (typeof BroadcastChannel !== 'undefined') {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current.onmessage = () => load();
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, BACKGROUND_REFRESH_MS);

    return () => {
      mountedRef.current = false;
      channelRef.current?.close();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(interval);
    };
  }, [load]);

  return { data, status, error, serverNow, reload: load, retry, notifyOtherTabs, clearError: () => setError(null) };
}
