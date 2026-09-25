/**
 * Builds a "server now" function from a server timestamp.
 *
 * The estimate is anchored to performance.now(), a monotonic clock that is unaffected by the user changing the
 * device date/time. So if someone moves their PC/phone clock forward 24h, the countdown doesn't move at all.
 * This clock is only used to *display* a countdown; the backend alone decides whether a reward is claimable.
 */
export function createServerClock(serverTimeIso, { requestedAt, receivedAt }) {
  const serverMs = Date.parse(serverTimeIso);
  if (Number.isNaN(serverMs)) return () => NaN;
  // Assume the server stamped the response halfway through the round trip.
  const anchorServerMs = serverMs + (receivedAt - requestedAt) / 2;
  const anchorPerf = receivedAt;
  return () => anchorServerMs + (performance.now() - anchorPerf);
}

export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { hours, minutes, seconds };
}

export function formatDuration(ms) {
  const { hours, minutes, seconds } = splitDuration(ms);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}
