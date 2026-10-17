import { useCallback, useRef, useState } from 'react';
import { confirmClaim, startClaim } from '../services/streakApi';

const CANCELLED = 'CLAIM_CANCELLED';
// The server sets readyAt before it replies, so waiting the demo length from when the reply arrives
// already lands past readyAt; the small margin only absorbs clock skew between API instances.
const READY_MARGIN_MS = 60;
const NOT_READY_RETRY_MS = 350;
const MAX_NOT_READY_RETRIES = 6;
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
  const cancelRef = useRef(null);

  /** One timer for the whole demo; Cancel rejects it immediately instead of waiting for a poll tick. */
  const waitForCpa = useCallback(
    (seconds) =>
      new Promise((resolve, reject) => {
        const id = window.setTimeout(() => {
          cancelRef.current = null;
          resolve();
        }, seconds * 1000 + READY_MARGIN_MS);
        cancelRef.current = () => {
          window.clearTimeout(id);
          cancelRef.current = null;
          reject(new Error(CANCELLED));
        };
      }),
    []
  );

  const confirmWithRetry = useCallback(async (claimSessionId) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await confirmClaim(claimSessionId);
      } catch (err) {
        // The server decides when verification is complete; if it says "not yet", wait and ask again.
        if (err.code === 'CPA_NOT_COMPLETED' && attempt < MAX_NOT_READY_RETRIES) {
          await sleep(NOT_READY_RETRY_MS);
          continue;
        }
        throw err;
      }
    }
  }, []);

  // The confirm response is the backend's own receipt, so it is shown straight away; the page
  // state is then re-fetched from the backend in the background (the UI never marks a day itself).
  const finish = useCallback(
    (claimResult) => {
      setResult(claimResult);
      setPhase('success');
      reload().then(notifyOtherTabs);
    },
    [reload, notifyOtherTabs]
  );

  const claim = useCallback(async () => {
    // Double-click guard (UX only - the backend independently prevents duplicate grants).
    if (busyRef.current) return;
    busyRef.current = true;
    cancelRef.current = null;
    setError(null);
    setResult(null);
    setSession(null);
    setReward(null);
    setPhase('starting');

    try {
      const started = await startClaim();
      if (!started.cpaRequired) {
        finish(started);
        return;
      }
      setReward(started.reward);
      setSession(started.claimSession);
      setPhase('cpa');
      await waitForCpa(started.claimSession.durationSeconds);
      setPhase('confirming');
      finish(await confirmWithRetry(started.claimSession.id));
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
    cancelRef.current?.();
  }, []);

  const close = useCallback(() => {
    if (busyRef.current) return;
    setPhase('idle');
  }, []);

  return { phase, session, reward, result, error, claim, cancel, close, isBusy: phase === 'starting' || phase === 'cpa' || phase === 'confirming' };
}
