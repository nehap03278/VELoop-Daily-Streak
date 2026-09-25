/**
 * Single source of "now" for every streak decision. Always server time — the client clock is never consulted.
 * A time offset can only be applied from automated tests (NODE_ENV=test) to simulate days passing.
 */
let offsetMs = 0;

function now() {
  return new Date(Date.now() + offsetMs);
}

function setTestOffset(ms) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Clock offset is only available in tests');
  offsetMs = ms;
}

function advanceTestClock(ms) {
  setTestOffset(offsetMs + ms);
}

module.exports = { now, setTestOffset, advanceTestClock };
