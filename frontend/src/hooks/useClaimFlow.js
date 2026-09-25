import { useCallback, useRef, useState } from 'react';
import { confirmClaim, startClaim } from '../services/streakApi';

const CANCELLED = 'CLAIM_CANCELLED';
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Claim UX state machine:
 *   idle -> starting (backend validates) -> cpa (ad demo) -> confirming (backend grants) -> success | error
 * The UI never marks anything as claimed itself: after success it re-fetches the full state from the backend.
 */
export function useClaimFlow({ reload, notifyOtherTabs }) {
  const [phase, setPhase] = useState('idle');
  const [session, setSession] = useState(null);
  const [reward, setReward] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const busyRef = useRef(false);
  const cancelRef = useRef(false);

  const waitForCpa = useCallback(async (seconds) => {
    const endsAt = performance.now() + seconds * 1000 + 300;
    while (performance.now() < endsAt) {
      if (cancelRef.current) throw new Error(CANCELLED);
      await sleep(100);
    }
  }, []);

  const confirmWithRetry = useCallback(async (claimSessionId) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await confirmClaim(claimSessionId);
      } catch (err) {
        // The server decides when verification is complete; if it says "not yet", wait and ask again.
        if (err.code === 'CPA_NOT_COMPLETED' && attempt < 4) {
          await sleep(1200);
          continue;
        }
        throw err;
      }
    }
  }, []);

  const finish = useCallback(
    async (claimResult) => {
      setResult(claimResult);
      await reload();
      notifyOtherTabs();
      setPhase('success');
    },
    [reload, notifyOtherTabs]
  );

  const claim = useCallback(async () => {
    // Double-click guard (UX only - the backend independently prevents duplicate grants).
    if (busyRef.current) return;
    busyRef.current = true;
    cancelRef.current = false;
    setError(null);
    setResult(null);
    setSession(null);
    setReward(null);
    setPhase('starting');

    try {
      const started = await startClaim();
      if (!started.cpaRequired) {
        await finish(started);
        return;
      }
      setReward(started.reward);
      setSession(started.claimSession);
      setPhase('cpa');
      await waitForCpa(started.claimSession.durationSeconds);
      setPhase('confirming');
      await finish(await confirmWithRetry(started.claimSession.id));
    } catch (err) {
      if (err.message === CANCELLED) {
        setPhase('idle');
      } else {
        setError(err);
        setPhase('error');
        reload();
      }
    } finally {
      busyRef.current = false;
    }
  }, [finish, waitForCpa, confirmWithRetry, reload]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const close = useCallback(() => {
    if (busyRef.current) return;
    setPhase('idle');
  }, []);

  return { phase, session, reward, result, error, claim, cancel, close, isBusy: phase === 'starting' || phase === 'cpa' || phase === 'confirming' };
}
