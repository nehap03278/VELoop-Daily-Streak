# Testing — VELoop Daily Streak

Three layers of testing were used:

1. **Automated API tests** (Jest + Supertest against a real MongoDB): 69 tests in `backend/tests`.
2. **Postman collection** (`postman/VELoop_Daily_Streak.postman_collection.json`): 29 requests and 60 assertions, run end to end with newman against the running server.
3. **Browser tests** (headless Chrome via playwright-core, run during development): the real UI claim flow, device-clock tampering, countdown expiry, reset state, and a layout sweep at every required breakpoint.

## Last recorded results

| Suite | Environment | Result |
| --- | --- | --- |
| `npm test` | MongoDB 8.2 standalone (atomic ops + compensation path) | **69 / 69 passed** |
| `npm run test:replset` | MongoDB 8.2 single-node replica set (transaction path) | **69 / 69 passed** |
| Production boot | `NODE_ENV=production` against standalone and replica set | Refuses standalone; starts with transactions on the replica set; `/api/dev/*` → 404 even with `ENABLE_DEV_TOOLS=true`; CORS allow-list enforced |
| `newman run …postman_collection.json` | Running API (`ENABLE_DEV_TOOLS=true`) | **29 requests, 60 / 60 assertions passed** |
| Browser: claim flow, clock tamper, countdown→refresh, reset | Chrome headless, 390px + 1440px | All passed (see §4) |
| Browser: layout sweep 320 → 1920px | Chrome headless | No horizontal overflow at any width; no clipped text |

## 1. Running the tests

```bash
cd backend
npm install
npm test                                          # uses mongodb://127.0.0.1:27017 (one temporary DB per test file)
TEST_MONGO_URI="mongodb://host:port" npm test     # any other MongoDB

# Transaction path (replica set). Example single-node set on port 27018:
mongod --replSet rs0 --port 27018 --dbpath ./rs0-data
mongosh --port 27018 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]})"
npm run test:replset

# Postman / newman (server running with ENABLE_DEV_TOOLS=true, seeded)
cd ../postman && npx newman run VELoop_Daily_Streak.postman_collection.json
```

### How time is tested

All streak decisions call `utils/clock.now()`. In tests only (`NODE_ENV=test`), a **server** clock offset can be applied with `clock.advanceTestClock(ms)`. This is how the tests simulate "24 hours later", "the CPA demo finished", or "Day 3 was missed", without touching the client and without waiting. In any other environment the offset function throws.

For manual and Postman testing, `POST /api/dev/time-travel { hours }` (only mounted when `ENABLE_DEV_TOOLS=true`) moves the **caller's own** stored timestamps back by N hours, which is equivalent to that much time passing for that user.

Note: the Postman collection and the QA panel use `/api/dev/*`, which only exists when the backend runs locally with `NODE_ENV=development` and `ENABLE_DEV_TOOLS=true`. It is never available on a production deployment.

## 2. Scenario matrix (spec §111 / §122)

| Scenario | Expected | Automated test(s) | Postman request |
| --- | --- | --- | --- |
| Normal claim | Day 1 claimed, +5 VEs, ledger row, audit events | `claim.test.js › start -> CPA demo -> finalize grants…` | *Claim Day 1 - start / confirm* |
| Already claimed | `409 ALREADY_CLAIMED` | `claim.test.js › re-claiming an already claimed day…` | *[neg] Re-claim Day 1* |
| Locked reward | `409 REWARD_LOCKED` until `nextClaimAt` | `claim.test.js › locked reward cannot be claimed…` | *[neg] Claim locked Day 2* |
| Timer | `nextClaimAt = claimedAt + 24h`; locked at 23h59m, claimable at 24h01m | `claim.test.js › after claiming, refreshed state…`, `› locked reward…` | *Get updated streak* |
| Missed day | Day 1+2 claimed, window passes → reset | `missedDay.test.js › Day 1 + Day 2 claimed, Day 3 missed…` | *Simulate +49h (miss Day 3)* |
| Reset | streak 0, Day 1 AVAILABLE, cycle BROKEN, `resetNotice` (Day 3 MISSED), single `STREAK_RESET` audit | same + `› status endpoint also detects…` | *Get streak after reset* |
| Not reset while inside the window (browser closed) | Streak kept at 47h | `missedDay.test.js › claiming inside the window keeps the streak…` | – |
| Duplicate request | Second confirm returns `idempotent: true`, credited once | `claim.test.js › finalizing the same claim session twice…` | *[neg] Duplicate confirm* |
| Concurrent request | 10 parallel confirms → 1 grant; 2 parallel Day 2 claims → +10 not +20 | `concurrency.test.js` (all 5 tests) | – |
| Multiple tabs | 5 sessions for the same day → exactly 1 grant; tab B after tab A → `ALREADY_CLAIMED` | `concurrency.test.js › multiple tabs…`, `› tab B cannot claim…` | – |
| Fake reward | `reward/amount/currency/rewardType` ignored → +5 / +10 VES; `TAMPERED_REQUEST` audit | `security.test.js › client supplied reward…` | *Claim Day 2 - start (with fake…)* + confirm |
| Fake day | `{day:7}` on Day 2 → `403 DAY_NOT_ELIGIBLE`; `?day=7` ignored | `security.test.js › requesting Day 7…`, `› query-string ?day=7…` | *[neg] Jump to Day 7* |
| Fake streak | `{streak:7}` ignored, real streak returned | `security.test.js › client supplied reward…` | *Claim Day 2 - confirm (real streak = 2)* |
| Fake user | `{userId}` ignored; other user's session → 404; history scoped | `security.test.js › fake user / cross-user access` (3 tests) | *[neg] Other user cannot confirm this session* |
| Changed device time | Client `Date`/`X-Client-Time`/body timestamps ignored → still locked | `security.test.js › client time hints never unlock…` + browser test | – |
| Unauthorized request | Every protected route → `401`; forged/expired/`alg:none`/bad-sub tokens → 401 | `auth.test.js` (9 tests) | *[neg] No token*, *[neg] Forged token* |
| Previous-day validation | Missing ledger entry for day − 1 → `409 PREVIOUS_DAY_NOT_CLAIMED` | `security.test.js › previous-day validation` | – |
| CPA demo cannot grant | Confirm before `readyAt` → `425`; without session → `400` | `claim.test.js` | *[neg] Confirm before CPA finished*, *[neg] Missing CPA session* |
| Expired / stale session | `410 CLAIM_SESSION_EXPIRED`; session from before a reset → `409` | `claim.test.js › an abandoned claim session expires`, `missedDay.test.js › a claim session opened before a reset…` | – |
| Refresh state | Reload / re-login shows Day 1 CLAIMED, Day 2 LOCKED | `claim.test.js › refresh / logout-login…` + browser | *Get updated streak* |
| Full cycle | 7 claims → cycle COMPLETED, wallet 60 VEs + ₹8, next cycle after 24h, streak continues to 8 | `missedDay.test.js › completing Day 7…` | – |
| Config-driven rewards | Changing Day 2 to 15 VEs in the DB changes the UI data and the grant | `claim.test.js › Backend-driven configuration` (3 tests) | – |
| Database integrity | Claim → reward → transaction → wallet linked; unique indexes enforced by MongoDB | `claim.test.js › …records everything`, `security.test.js › Database constraints` | *Get transactions* |
| Account eligibility | Suspended account → `403` | `security.test.js › a suspended account…` | – |
| Error hygiene | Malformed JSON → clean `INVALID_JSON`; operator injection → `VALIDATION_ERROR`; no internals leaked | `security.test.js › Error hygiene` | *[neg] Malformed JSON*, *[neg] Invalid day type* |

## 3. Automated test inventory

```
streakCalculator.test.js   (9)  pure rule unit tests: unlock, window, reset-once, cycle rollover, config-driven intervals, card states
auth.test.js              (13)  register/login, generic errors, validation, 401 on all 7 protected routes, forged/expired/none/bad-sub tokens, /me
claim.test.js             (13)  initial state, full flow + DB linkage, refresh state, locked, already claimed, idempotency,
                                CPA required, session expiry, re-login persistence, history/ledger, 3× config-driven
security.test.js          (16)  fake day ×4, fake reward/streak, fake user ×3, device clock, suspended account,
                                previous-day validation, 2× DB constraints, 3× error hygiene
concurrency.test.js        (5)  10 parallel confirms, 5 tabs, tab A/B, parallel Day 2 (+10 not +20), parallel first access
productionConfig.test.js   (6)  unset NODE_ENV = production (no fallbacks), short JWT secret refused, dev tools blocked in production,
                                transactions required in production, CORS origin normalisation / proxy hops, startup refuses standalone MongoDB
missedDay.test.js          (7)  reset with timeline + cycles + single audit, status endpoint, inside-window keep,
                                STREAK_RESET on claim, stale session after reset, full 7-day cycle, miss after completion
```

## 4. Browser / UI verification

These checks were run during development with headless Chrome (playwright-core) against the Vite dev server and the running API:

| Check | Method | Result |
| --- | --- | --- |
| Loader → content | Screenshot at 250 ms and after load | Branded loader, then the page |
| Claim flow through the UI | Click *Claim Now* → CPA demo modal (progress bar) → success receipt → close | Requests: `POST /claim/start {}` → `POST /claim {claimSessionId}` → `GET /daily-streak`; Day 1 CLAIMED, wallet 0 → 5, Day 2 countdown |
| Device clock manipulation | In-page `Date.now` overridden to +25h | Day 2 countdown stayed at `23:59:55`, no claim button |
| Countdown expiry | DB interval temporarily set to 1 min; waited on the page | At 00:00 the page issued one `GET /daily-streak`; the backend returned AVAILABLE and the button changed to *Claim Reward* without a reload |
| Missed-day UI | `POST /dev/time-travel {hours:49}` then reload | *Streak reset* banner with a ✓ ✓ ✗ timeline, "Start your streak", Day 1 *Claim Now* |
| Login | *Use demo account* → *Log in* | Redirect to `/daily-streak` |
| Streak Calendar | Click on desktop | Modal lists the cycle and the check-ins with reference IDs |
| Responsive sweep | 320, 360, 375, 390, 414, 480, 768, 820, 834, 1024, 1280, 1366, 1440, 1920 | `scrollWidth - innerWidth = 0` at every width; no truncated card text; layouts: mobile 4+3 (2-col below 360), tablet stacked hero + 4+3, desktop side-by-side hero + 7 in a row |
| Console | Page errors captured during all runs | None |

## 5. Manual checks for evaluators

1. Log in as `demo@veloop.in` / `Demo@1234`, open the Daily Streak page and claim Day 1.
2. In React DevTools, change a card's `status` or the `streak` prop, then click Claim. The backend answers `REWARD_LOCKED`, which appears in the claim modal, and the UI re-syncs.
3. Change the OS clock forward 24h and reload. The card is still locked because the countdown uses server time.
4. Open two tabs and claim in one. The other re-syncs on focus, and any claim attempt there is rejected.
5. Use the QA panel on the home page (`VITE_ENABLE_DEV_TOOLS=true` + backend `ENABLE_DEV_TOOLS=true`). *+24 hours* makes Day 2 claimable; *+49 hours* shows the reset.
6. Inspect MongoDB: `streakclaims`, `wallettransactions`, `wallets` and `auditlogs` (queries in DATABASE.md).
