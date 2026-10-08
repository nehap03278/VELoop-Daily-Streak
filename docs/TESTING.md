# Testing — VELoop Daily Streak

Three layers of testing were used:

1. **Automated API tests** (Jest + Supertest against a real MongoDB): 77 tests in `backend/tests`.
2. **Postman collection** (`postman/VELoop_Daily_Streak.postman_collection.json`): 41 requests and 86 assertions, run with newman, in two folders:
   - **Production / Live Flow** (24 requests, 53 assertions): public endpoints only, safe against the deployed API.
   - **Local QA Only** (17 requests): uses `/api/dev/*`, which exists only on a local development backend.
3. **Browser tests** (headless Chrome via playwright-core, run during development): the real UI claim flow, device-clock tampering, countdown expiry, reset state, TODAY/MISSED card rendering, and a layout sweep at every required breakpoint.

## Completed — last recorded results

| Suite | Environment | Result |
| --- | --- | --- |
| `npm test` | MongoDB 8.2 standalone (atomic ops + compensation path) | **77 / 77 passed** |
| `npm run test:replset` | MongoDB 8.2 single-node replica set (transaction path) | **77 / 77 passed** |
| `cardState.test.js` (part of the above) | Both environments | **8 / 8 passed** (TODAY and MISSED card states) |
| Postman: full collection | Local API, `NODE_ENV=development`, `ENABLE_DEV_TOOLS=true` | **41 requests, 86 / 86 assertions passed** |
| Postman: *Production / Live Flow* folder | Local API in development mode | **24 requests, 53 / 53 assertions passed** |
| Postman: *Production / Live Flow* folder | Local API in production mode (`NODE_ENV=production`) | **24 requests, 53 / 53 assertions passed** |
| Postman: *Local QA Only* folder | Local API in production mode | All 3 `/api/dev/*` requests returned **404**, as expected (dev routes are not mounted in production) |
| Production boot | `NODE_ENV=production` against standalone and replica set | Refuses standalone; starts with transactions on the replica set; `/api/dev/*` → 404 even with `ENABLE_DEV_TOOLS=true`; CORS allow-list enforced |
| Browser: claim flow, clock tamper, countdown→refresh, reset | Chrome headless, 390px + 1440px | All passed (see §4) |
| Browser: TODAY / MISSED cards | Chrome headless, 1440px, production build | New user: `today, locked ×6`. After missing Day 3: `today, locked, missed, locked ×4`. No page errors. |
| Browser: layout sweep 320 → 1920px | Chrome headless | No horizontal overflow at any width; no clipped text |
| Running UI: TODAY / MISSED (2026-10-06) | Local `npm run dev` frontend (:5173) + `npm start` backend (:5000), Chrome headless | Backend and UI agreed card-for-card: new user `TODAY, LOCKED ×6`; after Day 1 + 2 claimed and Day 3 missed `TODAY, LOCKED, MISSED, LOCKED ×4`, with a gold *Today* Day 1, a red *Missed* Day 3 card and the reset banner (✓ ✓ ✗). Passed. |
| Running UI renders backend `state` (2026-10-06) | Same; the API response was intercepted and Day 5's `state` changed to `MISSED` (its `status` left `LOCKED`) | The UI rendered Day 5 as *Missed*: it displays the backend `state` field rather than deriving the state itself. Passed. |
| **MongoDB Atlas: transactions** (2026-10-06) | Real Atlas cluster `Cluster0` (M0, 3-member replica set, MongoDB 8.0.34), scratch database `veloop_atlas_txcheck` | Connected; `hello` reported a replica set with 3 members. A real multi-document transaction committed 2/2 writes together; inside a second transaction the writes were visible to the session but 0 were visible outside it, and after `abortTransaction` 0 persisted. Passed. |
| **MongoDB Atlas: backend suite** (2026-10-06) | `npm test` with `TEST_MONGO_URI` pointing at the Atlas cluster (temporary `veloop_test_*` databases) | **77 / 77 passed** (8 suites, 136 s), on the transaction path |
| **MongoDB Atlas: production-mode API** (2026-10-06) | `NODE_ENV=production` (transactions required, dev tools off) against a dedicated `veloop_atlas_verify` database, seeded with `seed/seed.js` | Log: `multi-document transactions: enabled`. `/api/health` 200; `/api/dev/*` 404. Claim: register → Day 1 `AVAILABLE/TODAY` → start 202 → confirm 200 (+5 VES, balance 0 → 5) → replay 200 `idempotent: true`. Atlas records linked: claim (day 1) → reward (day 1, 5 VES) → ledger row (5 VES, 0 → 5, same `referenceId`) → wallet VES 5; session `COMPLETED`; streak 1. Exactly 1 claim and 1 ledger row. Passed. |
| **MongoDB Atlas: parallel duplicate claims** (2026-10-06) | Same API; fresh users | 10 simultaneous confirms of one session → one 200 grant and 9 × `409 CLAIM_IN_PROGRESS`; Atlas: 1 claim, 1 ledger row, wallet 5. Five tabs (5 sessions, same day) confirmed at once → one 200 and 4 × `409 ALREADY_CLAIMED`; Atlas: 1 claim, 1 ledger row, wallet 5. Audit log recorded `DUPLICATE_CLAIM` events. Passed. |
| Atlas cleanup (2026-10-06) | `veloop_atlas_txcheck`, `veloop_atlas_verify` and a leftover empty `veloop_test_prodconfig` dropped | Atlas database list identical to before verification (only the owner's pre-existing databases). No verification data left behind. |
| Client-side state tampering (2026-10-06) | Same; React hook state edited through the fiber `queue.dispatch`, the mechanism React DevTools uses to edit hooks (see §4) | Forged *Today* cards, streak 7 and 99,999 VEs appeared in the browser, but every claim was decided by the backend. Nothing claimable → `409 REWARD_LOCKED`, wallet and streak unchanged. Day 2 claimable with Day 7 forged → the backend granted Day 2 (+10 VEs), not Day 7. Passed. |

## Pending — not yet done

These have **not** been performed yet and must not be treated as complete:

| Item | Why it is pending | How to complete it |
| --- | --- | --- |
| Live deployment smoke test | The app is not deployed yet. Atlas itself is verified (see above), but the deployed Render + Vercel stack is not. | Deploy, confirm the Render log says `multi-document transactions: enabled`, run the *Production / Live Flow* folder with `--env-var baseUrl=https://<api-domain>/api`, then claim Day 1 through the live UI |
| Human check of tampering in the React DevTools extension UI | The tampering test above edited hook state programmatically, using the same mechanism as DevTools, and passed. A person editing state by hand in the DevTools extension has not been recorded. | Optional: follow §5 step 2 while recording the demo video |
| Demo video (submission requirement) | Not recorded yet | Record the spec §120 journey on the live site, plus the missed-day reset and a two-tab claim locally |

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

# Postman / newman (seeded database)
cd ../postman
npx newman run VELoop_Daily_Streak.postman_collection.json                                   # full collection (local dev backend)
npx newman run VELoop_Daily_Streak.postman_collection.json --folder "Production / Live Flow"  # public endpoints only
npx newman run VELoop_Daily_Streak.postman_collection.json --folder "Production / Live Flow" --env-var baseUrl=https://<api-domain>/api
npx newman run VELoop_Daily_Streak.postman_collection.json --folder "Local QA Only"           # local dev backend only
```

### How time is tested

All streak decisions call `utils/clock.now()`. In tests only (`NODE_ENV=test`), a **server** clock offset can be applied with `clock.advanceTestClock(ms)`. This is how the tests simulate "24 hours later", "the CPA demo finished", or "Day 3 was missed", without touching the client and without waiting. In any other environment the offset function throws.

For manual and Postman testing, `POST /api/dev/time-travel { hours }` moves the **caller's own** stored timestamps back by N hours, which is equivalent to that much time passing for that user.

`/api/dev/*` is **Local QA Only**. It is mounted only when the backend runs with `NODE_ENV=development` (or `test`) and `ENABLE_DEV_TOOLS=true`. In production it is intentionally unavailable and returns 404, so the *Local QA Only* Postman folder and the home-page QA panel work only against a local backend. The *Production / Live Flow* folder does not use it.

## 2. Scenario matrix (spec §111 / §122)

Postman column: **Live** = *Production / Live Flow* folder, **QA** = *Local QA Only* folder.

| Scenario | Expected | Automated test(s) | Postman request |
| --- | --- | --- | --- |
| Normal claim | Day 1 claimed, +5 VEs, ledger row, audit events | `claim.test.js › start -> CPA demo -> finalize grants…` | Live + QA: *Claim Day 1 - start / confirm* |
| Already claimed | `409 ALREADY_CLAIMED` | `claim.test.js › re-claiming an already claimed day…` | Live: *[neg] Re-claim Day 1* |
| Locked reward | `409 REWARD_LOCKED` until `nextClaimAt` | `claim.test.js › locked reward cannot be claimed…` | Live + QA: *[neg] Claim locked Day 2* |
| Timer | `nextClaimAt = claimedAt + 24h`; locked at 23h59m, claimable at 24h01m | `claim.test.js › after claiming, refreshed state…`, `› locked reward…` | Live: *Verify Day 1 (updated streak)*; QA: *Simulate +24h* |
| Card state TODAY | The claimable day is `status: AVAILABLE`, `state: TODAY` | `cardState.test.js` | Live: *Get streak*; QA: *Day 2 is TODAY* |
| Missed day | Day 1+2 claimed, window passes → reset | `missedDay.test.js › Day 1 + Day 2 claimed, Day 3 missed…` | QA: *Simulate +49h (miss Day 3)* |
| Reset | streak 0, Day 1 claimable (`TODAY`), cycle BROKEN, `resetNotice` (Day 3 MISSED), single `STREAK_RESET` audit | same + `› status endpoint also detects…` | QA: *Get streak after reset* |
| Card state MISSED | After missing Day 3, the Day 3 card is `status: LOCKED`, `state: MISSED` until the next claim; a missed Day 1 shows as `TODAY` (claimable again) | `cardState.test.js` | QA: *Get streak after reset* (Day 3 card state MISSED) |
| Not reset while inside the window (browser closed) | Streak kept at 47h | `missedDay.test.js › claiming inside the window keeps the streak…` | – |
| Duplicate request | Second confirm returns `idempotent: true`, credited once | `claim.test.js › finalizing the same claim session twice…` | Live: *[neg] Duplicate confirm* |
| Concurrent request | 10 parallel confirms → 1 grant; 2 parallel Day 2 claims → +10 not +20 | `concurrency.test.js` (all 5 tests) | – |
| Multiple tabs | 5 sessions for the same day → exactly 1 grant; tab B after tab A → `ALREADY_CLAIMED` | `concurrency.test.js › multiple tabs…`, `› tab B cannot claim…` | – |
| Fake reward | `reward/amount/currency/rewardType` ignored → configured reward; `TAMPERED_REQUEST` audit | `security.test.js › client supplied reward…` | Live: *Claim Day 1 - start (with fake…)* + confirm (+5); QA: *Claim Day 2 - start (with fake…)* + confirm (+10) |
| Fake day | `{day:7}` on Day 1/2 → `403 DAY_NOT_ELIGIBLE`; `?day=7` ignored | `security.test.js › requesting Day 7…`, `› query-string ?day=7…` | Live + QA: *[neg] Jump to Day 7* |
| Fake streak | `{streak:7}` ignored, real streak returned | `security.test.js › client supplied reward…` | Live: *Claim Day 1 - confirm* (real streak = 1); QA: *Claim Day 2 - confirm* (real streak = 2) |
| Fake user | `{userId}` ignored; other user's session → 404; history scoped | `security.test.js › fake user / cross-user access` (3 tests) | Live + QA: *[neg] Other user cannot confirm this session* |
| Changed device time | Client `Date`/`X-Client-Time`/body timestamps ignored → still locked | `security.test.js › client time hints never unlock…` + browser test | – |
| Unauthorized request | Every protected route → `401`; forged/expired/`alg:none`/bad-sub tokens → 401 | `auth.test.js` (9 tests) | Live: *[neg] No token*, *[neg] Forged token* |
| Previous-day validation | Missing ledger entry for day − 1 → `409 PREVIOUS_DAY_NOT_CLAIMED` | `security.test.js › previous-day validation` | – |
| CPA demo cannot grant | Confirm before `readyAt` → `425`; without session → `400` | `claim.test.js` | Live: *[neg] Confirm before CPA finished*, *[neg] Missing CPA session* |
| Expired / stale session | `410 CLAIM_SESSION_EXPIRED`; session from before a reset → `409` | `claim.test.js › an abandoned claim session expires`, `missedDay.test.js › a claim session opened before a reset…` | – |
| Refresh state | Reload / re-login shows Day 1 CLAIMED, Day 2 LOCKED | `claim.test.js › refresh / logout-login…` + browser | Live: *Verify Day 1 (updated streak)* |
| Full cycle | 7 claims → cycle COMPLETED, wallet 60 VEs + ₹8, next cycle after 24h, streak continues to 8 | `missedDay.test.js › completing Day 7…` | – |
| Config-driven rewards | Changing Day 2 to 15 VEs in the DB changes the UI data and the grant | `claim.test.js › Backend-driven configuration` (3 tests) | – |
| Database integrity | Claim → reward → transaction → wallet linked; unique indexes enforced by MongoDB | `claim.test.js › …records everything`, `security.test.js › Database constraints` | Live: *Get transactions* |
| Account eligibility | Suspended account → `403` | `security.test.js › a suspended account…` | – |
| Error hygiene | Malformed JSON → clean `INVALID_JSON`; operator injection → `VALIDATION_ERROR`; no internals leaked | `security.test.js › Error hygiene` | Live: *[neg] Malformed JSON*, *[neg] Invalid day type* |
| Dev tools in production | `/api/dev/*` → 404 in production | `productionConfig.test.js` + production-mode run | QA folder against a production-mode API → 404 |

## 3. Automated test inventory (77 tests)

```
streakCalculator.test.js   (9)  pure rule unit tests: unlock, window, reset-once, cycle rollover, config-driven intervals, card statuses
cardState.test.js          (8)  explicit card state: TODAY for the claimable day, CLAIMED / LOCKED, MISSED for the missed day,
                                Day 1 exception (TODAY wins), allowed state values; API: new user TODAY, TODAY after the interval,
                                MISSED shown after a reset and cleared after the next claim
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

These checks were run during development with headless Chrome (playwright-core) against the running API:

| Check | Method | Result |
| --- | --- | --- |
| Loader → content | Screenshot at 250 ms and after load | Branded loader, then the page |
| Claim flow through the UI | Click *Claim Now* → CPA demo modal (progress bar) → success receipt → close | Requests: `POST /claim/start {}` → `POST /claim {claimSessionId}` → `GET /daily-streak`; Day 1 CLAIMED, wallet 0 → 5, Day 2 countdown |
| Device clock manipulation | In-page `Date.now` overridden to +25h | Day 2 countdown stayed at `23:59:55`, no claim button |
| Countdown expiry | DB interval temporarily set to 1 min; waited on the page | At 00:00 the page issued one `GET /daily-streak`; the backend returned the day as claimable and the button changed to *Claim Reward* without a reload |
| Missed-day UI | `POST /dev/time-travel {hours:49}` then reload | *Streak reset* banner with a ✓ ✓ ✗ timeline, "Start your streak", Day 1 *Claim Now* |
| TODAY / MISSED cards | Production build against the updated API; new user, then Day 1 + Day 2 claimed and Day 3 missed | Day 1 rendered as the gold *Today* card; Day 3 rendered as a red *Missed* card with a non-clickable *Missed* button; card states read from the backend `state` field |
| Login | *Use demo account* → *Log in* | Redirect to `/daily-streak` |
| Streak Calendar | Click on desktop | Modal lists the cycle and the check-ins with reference IDs |
| Responsive sweep | 320, 360, 375, 390, 414, 480, 768, 820, 834, 1024, 1280, 1366, 1440, 1920 | `scrollWidth - innerWidth = 0` at every width; no truncated card text; layouts: mobile 4+3 (2-col below 360), tablet stacked hero + 4+3, desktop side-by-side hero + 7 in a row |
| Running UI: TODAY / MISSED | `npm run dev` frontend + `npm start` backend; new user, then Day 1 + Day 2 claimed via the API and `POST /dev/time-travel` (+24h, +49h) | UI card states matched the backend `status/state` exactly. Day 1 card: "Today … Claim Reward". Day 3 card: "Missed … Missed". Reset banner: "You had a 2-day streak. Day 1 claimed, Day 2 claimed, Day 3 missed" |
| Frontend consumes backend `state` | `page.route` rewrote the `GET /api/daily-streak` response: Day 5 `state: MISSED`, `status` left `LOCKED` | Day 5 rendered as *Missed*. The card look follows the backend field and is not computed in the browser. |
| Tampering A: nothing claimable | Day 1 claimed (Day 2 locked). In the page, the `DailyStreakPage` hook state was edited via the React fiber `queue.dispatch` (as React DevTools does): Day 2 and Day 7 set to `AVAILABLE`/`TODAY`, streak 7, wallet 99,999. Then the forged Day 7 *Claim* was clicked. | The browser showed the forged cards and header. The request was `POST /claim/start {}` (no day or reward sent) → `409 REWARD_LOCKED` ("Your next reward is not available yet."). After *Got it* the UI re-synced to the backend (streak 1, 5 VEs, Day 2 locked). Backend wallet `{VES:5}` before and after; 1 claim; streak 1. |
| Tampering B: Day 2 claimable, Day 7 forged | After +24h, hook state edited so Day 2 looked locked and Day 7 looked claimable, then Day 7 *Claim* clicked | The backend derived the day itself: session `day: 2`, granted **Day 2 +10 VEs** (ledger: day 2, 10 VES; wallet 5 → 15 VEs, 0 INR). The forged Day 7 ₹5 reward was not granted. |

## 5. Manual checks for evaluators

Step 2 was verified programmatically on 2026-10-06 (see *Tampering A/B* in §4). A person clicking through the React DevTools extension has not been recorded yet.

1. Log in as `demo@veloop.in` / `Demo@1234`, open the Daily Streak page and claim Day 1.
2. In React DevTools, change a card's `status`/`state` or the `streak` prop, then click Claim. The backend answers `REWARD_LOCKED`, which appears in the claim modal, and the UI re-syncs.
3. Change the OS clock forward 24h and reload. The card is still locked because the countdown uses server time.
4. Open two tabs and claim in one. The other re-syncs on focus, and any claim attempt there is rejected.
5. Locally only: use the QA panel on the home page (`VITE_ENABLE_DEV_TOOLS=true` + backend `NODE_ENV=development`, `ENABLE_DEV_TOOLS=true`). *+24 hours* makes Day 2 claimable; *+49 hours* shows the reset and the *Missed* card.
6. Inspect MongoDB: `streakclaims`, `wallettransactions`, `wallets` and `auditlogs` (queries in DATABASE.md).
