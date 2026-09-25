import { useEffect, useRef, useState } from 'react';

/**
 * Visual countdown to a backend-provided timestamp using the server-anchored clock.
 * When it reaches zero it calls `onElapsed` once - the caller must then ask the backend for fresh state
 * instead of assuming the reward is claimable.
 */
export function useCountdown(targetIso, serverNow, onElapsed) {
  const target = targetIso ? Date.parse(targetIso) : null;
  const [remaining, setRemaining] = useState(() => (target && serverNow ? Math.max(0, target - serverNow()) : 0));
  const firedRef = useRef(false);
  const onElapsedRef = useRef(onElapsed);
  onElapsedRef.current = onElapsed;

  useEffect(() => {
    firedRef.current = false;
    if (!target || !serverNow) {
      setRemaining(0);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, target - serverNow());
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        if (onElapsedRef.current) onElapsedRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target, serverNow]);

  return remaining;
}
