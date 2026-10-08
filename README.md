# VELoop Rewards — Daily Streak System

A full-stack **MERN** implementation of the VELoop Rewards Daily Streak: a user logs in every day, keeps a consecutive-day streak and unlocks increasingly valuable rewards across a 7-day cycle.

> **React controls the presentation. The backend controls the streak.**
> Streak count, current day, eligibility, reward values, unlock time, missed-day detection, resets, wallet balance and the reward ledger are all computed and enforced by the Node/Express API against MongoDB, using server time only.

---

## Contents

1. [Project overview](#1-project-overview)
2. [MERN architecture](#2-mern-architecture)
3. [Installation](#3-installation)
4. [Environment setup](#4-environment-setup)
5. [Database schema](#5-database-schema)
6. [Streak logic](#6-streak-logic)
7. [Claim logic](#7-claim-logic)
8. [Timer architecture](#8-timer-architecture)
9. [Reset logic](#9-reset-logic)
10. [Reward system](#10-reward-system)
11. [Wallet integration](#11-wallet-integration)
12. [Security](#12-security)
13. [API endpoints](#13-api-endpoints)
14. [Testing](#14-testing)
15. [Deployment](#15-deployment)
16. [Implementation decisions](#16-implementation-decisions)
17. [Known limitations](#17-known-limitations)

Further documentation: [API](docs/API_DOCUMENTATION.md) · [Database](docs/DATABASE.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Postman collection](postman/VELoop_Daily_Streak.postman_collection.json)

---

## 1. Project overview

| Area | What is included |
| --- | --- |
| Backend | Express 5 REST API, Mongoose models, JWT auth, service layer (`streak`, `reward`, `wallet`, `transaction`, `audit`), zod validation, rate limiting, Helmet, audit logs, seed script |
| Business rules | 7-day cycles configured in MongoDB, rolling 24h unlock with a 24h claim window, missed-day reset, previous-day validation, sequential claiming, cycle completion and rollover |
| Integrity | Unique `(user, cycle, day)` claim index, optimistic locking on streak state, atomic wallet `$inc`, idempotent claim sessions, MongoDB transactions when available |
| Frontend | React 18 + Vite + React Router, Bootstrap 5 grid/utilities + CSS Modules, Lucide/React Icons, supplied artwork (optimised WebP) |
| UX states | Branded loader, themed skeleton, error screen and toast, claimable/claimed/locked/next-countdown/reset states, CPA advertisement demo, success receipt, streak calendar (history) |
| Responsive | Dedicated mobile layout (4 + 3 cards), tablet layout (stacked hero, 4 + 3 grid), desktop layout (side-by-side hero, 7-card row); verified from 320px to 1920px |
| Docs & tests | 77 automated Jest/Supertest tests (standalone and replica-set MongoDB), a Postman collection (41 requests / 86 assertions, run with newman, split into *Production / Live Flow* and *Local QA Only*), browser-level checks |

### Repository layout

```
.
├── backend/
│   ├── src/
│   │   ├── config/        env + MongoDB connection (detects transaction support)
│   │   ├── controllers/   thin HTTP handlers
│   │   ├── middleware/    auth (JWT), validation, rate limiting, error handler
│   │   ├── models/        User, Wallet, StreakConfig, StreakReward, StreakCycle,
│   │   │                  UserStreak, StreakClaim, ClaimSession, WalletTransaction, AuditLog
│   │   ├── routes/        /api routes
│   │   ├── services/      streak / reward / wallet / transaction / audit / auth / dev
│   │   ├── utils/         clock (server time), streakCalculator (pure rules), ids, transaction helper
│   │   └── validators/    zod schemas
│   ├── seed/              reward configuration + demo users
│   └── tests/             Jest + Supertest suites
├── frontend/
│   └── src/
│       ├── pages/DailyStreak/   page + components (each with its own CSS Module)
│       ├── pages/Login, pages/Home
│       ├── services/            centralised API layer (apiClient, streakApi, walletApi, authApi)
│       ├── hooks/               useDailyStreak, useClaimFlow, useCountdown
│       ├── context/             AuthContext
│       ├── utils/               server clock, formatting, reward asset map
│       └── assets/rewards/      supplied artwork (optimised)
├── docs/                  API_DOCUMENTATION.md, DATABASE.md, SECURITY.md, TESTING.md
├── postman/               collection + generator script
└── render.yaml            backend deployment blueprint
```

---

## 2. MERN architecture

```
MongoDB  ──▶  Node.js / Express (services = business rules)  ──▶  REST API (JWT)
                                                                    │
React UI  ◀──  React state  ◀──  hooks (useDailyStreak / useClaimFlow)  ◀──  services/streakApi.js
```

- **Routes → controllers → services.** Controllers only translate HTTP. All rules live in `backend/src/services/streak.service.js` and the pure `backend/src/utils/streakCalculator.js`.
- **The frontend renders backend state.** The Daily Streak page renders the response of `GET /api/daily-streak`, which includes the streak summary, statistics, the ultimate reward, one object per day card with its status, the wallet and `serverTime`. After every claim it fetches this state again. It never updates a card, counter or balance optimistically.

---

## 3. Installation

Requirements: **Node.js ≥ 18.18** (developed on Node 24) and **MongoDB ≥ 6** (local or Atlas).

```bash
# 1. Backend
cd backend
cp .env.example .env            # then edit MONGO_URI / JWT_SECRET
npm install
npm run seed                    # reward config, streak rules and demo users (idempotent)
npm run dev                     # http://localhost:5000  (npm start in production)

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env            # VITE_API_URL=http://localhost:5000
npm install
npm run dev                     # http://localhost:5173
```

**Demo credentials** (created by the seed):

| Email | Password | Notes |
| --- | --- | --- |
| `demo@veloop.in` | `Demo@1234` | 100 VEs welcome bonus |
| `demo2@veloop.in` | `Demo@1234` | second account, used for cross-user tests |

You can also create a new account on the login screen.

---

## 4. Environment setup

### Backend (`backend/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | **yes** locally | `development` locally, `production` when deployed. **If unset, the app runs as production:** no local fallbacks, dev tools off, transactions required. |
| `PORT` | no | API port (default `5000`; Render/Railway inject it) |
| `MONGO_URI` | **yes** (prod) | Your own MongoDB Atlas development database. Never a production DB. |
| `JWT_SECRET` | **yes** (prod) | ≥ 32 random characters. The server refuses to start in production without it or with a short secret. |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `7d`) |
| `CLIENT_URL` | **yes** (prod) | Comma-separated allowed browser origins for CORS, e.g. `https://veloop-streak.vercel.app` (a trailing `/` is ignored) |
| `TRUST_PROXY` | prod | `true` (1 hop) or a hop count behind Render/Railway, so rate limiting sees real client IPs |
| `REQUIRE_TRANSACTIONS` | no | Defaults to `true` in production: the API **refuses to start** on a standalone MongoDB, so the local rollback path can never become the production path. Set `false` only for a local standalone `mongod`. |
| `ENABLE_DEV_TOOLS` | no | `true` mounts the QA-only `/api/dev/*` routes (time travel for the caller's own account). **Only honoured when `NODE_ENV` is `development`/`test`; always ignored in production.** |

### Frontend (`frontend/.env`)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | API origin, without `/api` (e.g. `https://veloop-api.onrender.com`). **Required for `npm run build`** — the build fails without it. |
| `VITE_ENABLE_DEV_TOOLS` | `true` shows the QA time-travel panel on the home page (local only; leave unset/`false` on Vercel) |

Only `.env.example` files are committed; `.env` files are git-ignored. `VITE_*` values are embedded in the public JavaScript bundle, so never put a secret in a `VITE_` variable. The frontend only needs the public API URL.

---

## 5. Database schema

Full field-level documentation is in [docs/DATABASE.md](docs/DATABASE.md). Summary:

| Collection | Purpose | Key constraints |
| --- | --- | --- |
| `users` | Accounts (bcrypt hash, `status` ACTIVE/SUSPENDED) | unique `email` |
| `wallets` | Per-user balances `VES` and `INR` (gift-card value) | unique `userId` |
| `streakconfigs` | Business rules: interval, window, CPA duration, reset rule | unique `key` |
| `streakrewards` | Day → reward type/currency/amount/title/asset/badge | unique active `day` |
| `userstreaks` | Authoritative streak state per user (+ `version` for optimistic locking) | unique `userId` |
| `streakcycles` | Each 7-day cycle: ACTIVE / COMPLETED / BROKEN | unique `(userId, cycleNumber)`, only **one ACTIVE** per user |
| `streakclaims` | One document per claimed day (reward snapshot, transaction link) | **unique `(userId, cycleId, day)`**, unique `claimSessionId` |
| `claimsessions` | Server-side CPA verification sessions (idempotency key) | unique `sessionId`, TTL cleanup |
| `wallettransactions` | Append-only ledger with `balanceBefore/After` | unique `transactionId`, unique `referenceId` |
| `auditlogs` | Security and business events | indexed by user/event/time |

Traceability: `StreakClaim.rewardId → StreakReward`, `StreakClaim.transactionId / referenceId → WalletTransaction`, `WalletTransaction.balanceAfter → Wallet`.

---

## 6. Streak logic

A **cycle** is the set of active reward days (7 in the seed). The user progresses sequentially inside a cycle.

State kept in `UserStreak`: `currentStreak`, `longestStreak`, `lastClaimedDay` (inside the active cycle), `lastClaimAt` (server time), `activeCycleId`, `cycleNumber`, `version`.

Everything else is **derived on every request** by `streakCalculator.evaluate(streak, config, totalDays, serverNow)`:

```
unlockAt  = lastClaimAt + claimIntervalMinutes      (next day becomes claimable)
deadline  = unlockAt   + claimWindowMinutes         (after this, the day is missed)
currentDay = lastClaimedDay + 1   (or Day 1 of the next cycle after Day 7)
claimable  = no previous claim  OR  serverNow >= unlockAt
missed     = currentStreak > 0  AND serverNow >= deadline
```

With the seeded config (1440 / 1440 minutes), the next day unlocks **24h after the previous claim** and must be claimed **within the following 24h**.

Every day card carries two backend-decided fields; the frontend only renders them:

- **`status`** (`CLAIMED` | `AVAILABLE` | `LOCKED`) is the claimability flag that drives the claim button (spec §34).
- **`state`** (`CLAIMED` | `TODAY` | `MISSED` | `LOCKED`) is the card state from spec §29:
  - `TODAY` is today's claimable day (`status: AVAILABLE`, `isToday: true`).
  - `MISSED` is the day whose window passed and broke the previous streak (`status: LOCKED`), shown until the next claim.
  - `LOCKED` includes the waiting day (`isNext: true` with `unlocksAt`).

Examples and the Day 1 exception are in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

**Cycle completion:** claiming the final day marks the cycle `COMPLETED`. The completed cycle stays on screen, with every card claimed and a countdown, until the next Day 1 unlocks. The next claim then opens cycle *n + 1*. The streak count continues across cycles (8, 9, …) while the user keeps claiming on time.

---

## 7. Claim logic

The claim runs in two backend-validated phases, so the CPA advertisement demo can never grant anything by itself:

```
POST /api/daily-streak/claim/start   → validates eligibility, opens a ClaimSession (readyAt = now + cpaDemoSeconds)
            (frontend shows the CPA Advertisement Demo)
POST /api/daily-streak/claim { claimSessionId } → re-validates everything, grants the reward exactly once
GET  /api/daily-streak               → frontend refreshes the whole UI from backend state
```

Validation, in order, is performed **independently on both calls**:

1. Authenticated user (JWT; identity never read from the body)
2. Streak exists (created race-safely if missing)
3. Missed-day check. If the window has passed, the streak is reset and the request is rejected with `STREAK_RESET`.
4. Current day correct. The day is derived by the server; an optional `day` in the body must match it.
5. Previous day claimed. This is checked against the `StreakClaim` ledger, not just the counter.
6. Waiting period completed (server time)
7. Today's reward not already claimed
8. Account eligible (`status === 'ACTIVE'`)
9. On confirm: the session belongs to the caller, is `PENDING`, `readyAt` has passed and it hasn't expired

The grant (`grantReward`) then performs these steps:

1. Insert `StreakClaim`. The unique `(userId, cycleId, day)` index is the duplicate lock.
2. Compare-and-set `UserStreak` on `version` (optimistic lock).
3. Atomic wallet `$inc` of the **configured** amount.
4. Insert the `WalletTransaction` with `balanceBefore/After` and a `STREAK-XXXXXXXX` reference.
5. Update the cycle (and complete it on the last day).
6. Mark the ClaimSession `COMPLETED` with its result.

On MongoDB replica sets (Atlas) all steps run in **one multi-document transaction**. On a standalone server the unique index and the version check still make a double grant impossible, and completed steps are compensated if a later step fails.

Idempotency: repeating `POST /claim` with the same `claimSessionId` returns the original result (`idempotent: true`) without crediting again. Error messages match the specification: *This reward has already been claimed.*, *Your next reward is not available yet.*, *Your streak has been reset. Start again from Day 1.*, *Please log in to continue.*, *Unable to process your reward. Please try again.*

---

## 8. Timer architecture

- The backend returns `serverTime`, `streak.nextClaimAt` (when the next day unlocks), `streak.streakExpiresAt` (claim deadline) and per-card `unlocksAt`.
- The frontend (`utils/serverClock.js`) anchors `serverTime` to **`performance.now()`**, a monotonic clock, and compensates half the request round trip. Changing the device date or time therefore **does not move the countdown**. This was verified in a real browser by overriding `Date.now` by +25h: the countdown stayed at 23:59:55.
- The countdown is display only. When it reaches zero, the page calls `GET /api/daily-streak`, and the card only becomes claimable if the backend reports `AVAILABLE`. Timer-triggered refreshes are throttled to one every 3 seconds.
- The page also re-fetches on tab focus and visibility change, every 5 minutes, and when another tab broadcasts a change (`BroadcastChannel`).
- The 24h values are configuration (`claimIntervalMinutes`, `claimWindowMinutes`), not constants in business logic.

---

## 9. Reset logic

- A missed day is detected **lazily and deterministically** from stored timestamps whenever the user's state is read (`GET /daily-streak`, `/status`, or either claim call). Closing the browser does not matter; only `serverNow >= deadline` does.
- The reset is a compare-and-set update: `currentStreak → 0`, `lastClaimedDay → 0`, and `lastReset = { at, missedDay, previousStreak, claimedDays }`. The broken cycle is marked `BROKEN` with its `missedDay`, and a new `ACTIVE` cycle is opened. A `STREAK_RESET` audit event is written exactly once.
- The API returns `streak.status = "RESET"` and a `resetNotice`, which includes a day timeline with `CLAIMED` / `MISSED` / `LOCKED` entries. The UI shows it as a banner until the user claims again.
- The day cards also show the miss directly: the missed day's card has `state: "MISSED"` (`status: "LOCKED"`, not claimable), rendered as a red *Missed* card. Day 1 is immediately claimable (`status: "AVAILABLE"`, `state: "TODAY"`).
- If the missed day was Day 1 itself, that card is `TODAY` rather than `MISSED`, because it is claimable again straight away. The miss still appears in `resetNotice` and the banner.

---

## 10. Reward system

Rewards live in the `streakrewards` collection (seeded from `backend/seed/data.js`):

| Day | Type | Currency | Amount | Asset | Badge |
| --- | --- | --- | --- | --- | --- |
| 1 | VES | VES | 5 | coin | – |
| 2 | VES | VES | 10 | coin | – |
| 3 | VES | VES | 15 | coin | – |
| 4 | GIFT_CARD (Amazon) | INR | 1 | gift-box | – |
| 5 | GIFT_CARD (Amazon) | INR | 2 | gift-card | Gift Card |
| 6 | VES | VES | 30 | coin | Coin |
| 7 | GIFT_CARD (Amazon) — *Ultimate* | INR | 5 | crown | VIP |

The API returns the reward identity, value, `displayValue` (for example `+10` or `₹5`), subtitle, badge and `assetType`. The frontend maps `assetType` to a bundled image, which is acceptable because an image is not a business value. Changing a document (for example Day 2 → 15 VEs) changes the cards, the statistics, the ultimate reward section and the amount granted, **with no code change**. An automated test covers this.

---

## 11. Wallet integration

- `Wallet.balances.VES` is the VEs balance shown as the gem balance in the header. `Wallet.balances.INR` accumulates the gift-card value.
- Credits use an atomic `$inc`. `balanceBefore` is derived from the post-image, so the ledger is exact even under concurrency.
- Every grant writes a `WalletTransaction` (`transactionId`, `userId`, `rewardType`, `amount`, `currency`, `source: DAILY_STREAK`, `streakDay`, `referenceId`, `balanceBefore`, `balanceAfter`, `status`, `createdAt`).
- The frontend never adds to a balance. It displays `wallet` from `GET /daily-streak` / `GET /wallet` after the backend confirms.

---

## 12. Security

Summary (details in [docs/SECURITY.md](docs/SECURITY.md)):

- **Authentication:** JWT (HS256 pinned), bcrypt (12 rounds), and a generic login error so accounts can't be enumerated. All streak and wallet routes are protected.
- **Identity:** always `req.user` from the verified token. Body or query `userId` is ignored, and claim sessions are looked up by `(sessionId, userId)`.
- **Never trusted from the client:** reward, amount, currency, streak, day, time. The fields are stripped by zod, and tampering attempts are recorded as `TAMPERED_REQUEST` audit events.
- **Duplicate and concurrent claims:** unique indexes, a version compare-and-set, the session `PENDING→PROCESSING` lock, and transactions.
- **Time:** server clock only. Client `Date` headers and body timestamps are ignored.
- **Hardening:** Helmet, a CORS allow-list, a 10 kb JSON limit, rate limits (auth 20/15 min per IP, claims 20/min per user, API 120/min per user), `Cache-Control: no-store`, and sanitised errors (no stack traces, `MongoServerError`, `CastError` or `AxiosError` text reaches the user).
- **Audit log:** `STREAK_CLAIM_REQUEST`, `STREAK_CLAIM_SUCCESS`, `STREAK_CLAIM_REJECTED`, `STREAK_RESET`, `DUPLICATE_CLAIM`, `INVALID_CLAIM`, `TAMPERED_REQUEST`, `STREAK_CYCLE_COMPLETED`, plus auth and dev-tool events.

---

## 13. API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | – | Liveness + server time |
| POST | `/api/auth/register` | – | Create account → `{ token, user }` |
| POST | `/api/auth/login` | – | Login → `{ token, user }` |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/daily-streak` | JWT | Full page state (streak, stats, ultimate reward, 7 cards, wallet, reset notice, serverTime) |
| GET | `/api/daily-streak/status` | JWT | Lightweight status (claimable, currentDay, nextClaimAt, serverTime) |
| POST | `/api/daily-streak/claim/start` | JWT | Validate + open CPA verification session |
| POST | `/api/daily-streak/claim` | JWT | Confirm claim with `claimSessionId` (idempotent) |
| GET | `/api/daily-streak/history` | JWT | Claims + cycles (paginated) |
| GET | `/api/wallet` | JWT | Balances |
| GET | `/api/wallet/transactions` | JWT | Ledger (paginated) |
| POST | `/api/dev/time-travel` | JWT | **QA only** (`ENABLE_DEV_TOOLS`) — shift the caller's own timestamps back N hours |
| POST | `/api/dev/reset-my-streak` | JWT | **QA only** — clear the caller's streak (ledger kept) |

Request and response examples and error codes are in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

---

## 14. Testing

```bash
cd backend
npm test                 # 77 tests against a local MongoDB (standalone → compensation path)
npm run test:replset     # same suite against a replica set (transaction path); needs mongod --replSet on :27018
# or: TEST_MONGO_URI="mongodb+srv://…" npm test

cd postman
npx newman run VELoop_Daily_Streak.postman_collection.json                                  # full collection, local: 41 requests / 86 assertions
npx newman run VELoop_Daily_Streak.postman_collection.json --folder "Production / Live Flow" # 24 requests / 53 assertions
npx newman run VELoop_Daily_Streak.postman_collection.json --folder "Production / Live Flow" --env-var baseUrl=https://<api-domain>/api
```

The Postman collection has two folders:

- **Production / Live Flow** (24 requests / 53 assertions) uses public endpoints only. It registers a fresh user each run, so it is repeatable against the deployed API.
- **Local QA Only** (17 requests) uses the `/api/dev/*` time-travel endpoints to demonstrate the 24h unlock, the missed-day reset and the `MISSED` card. `/api/dev/*` exists only on a local backend with `NODE_ENV=development` and `ENABLE_DEV_TOOLS=true`. It is intentionally unavailable in production, where those requests return 404.

The tests use a controllable **server** clock (`utils/clock.js`, test-only offset) to simulate the 24h lock, the claim window and missed days. [docs/TESTING.md](docs/TESTING.md) lists every scenario: normal claim, already claimed, locked, timer, missed day, reset, duplicate, concurrent, fake reward, fake day, fake streak, fake user, device time, unauthorized, refresh, multiple tabs and full cycle. It also describes how each was tested manually and in the browser.

---

## 15. Deployment

| Tier | Recommended | Notes |
| --- | --- | --- |
| Database | MongoDB Atlas (free M0) | Replica set, so claims run in real transactions (required in production) |
| Backend | Render (`render.yaml` blueprint) or Railway | Root `backend`, build `npm ci`, start `npm start`, health check `/api/health`. Env: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL=https://<frontend-domain>`, `TRUST_PROXY=true` (the blueprint pre-fills everything except `MONGO_URI` and `CLIENT_URL`, and generates `JWT_SECRET`) |
| Frontend | Vercel (`frontend/vercel.json`) or Netlify (`public/_redirects`, `public/_headers`) | Root `frontend`, build `npm run build`, output `dist`, env `VITE_API_URL=https://<api-domain>` |

Suggested order:

1. **Atlas:** create a cluster and a database user, and allow network access from your host (Render has no fixed IPs on the free plan, so `0.0.0.0/0` is typical for a dev cluster). Copy the `mongodb+srv://…/veloop_daily_streak` URI.
2. **Seed Atlas once**, from your machine: `cd backend && MONGO_URI="<atlas uri>" npm run seed` (PowerShell: `$env:MONGO_URI="<atlas uri>"; npm run seed`). This uses your local `.env` (`NODE_ENV=development`) with the Atlas URI and creates the reward config and demo users.
3. **Backend:** deploy with `render.yaml`, fill in `MONGO_URI` and `CLIENT_URL`, then check `/api/health`. The log must say `multi-document transactions: enabled`; on a standalone database the API refuses to start.
4. **Frontend:** deploy `frontend` on Vercel with `VITE_API_URL`, then set the backend's `CLIENT_URL` to the exact Vercel URL and redeploy the backend.

Dev tools (`/api/dev/*`) are never available in production (`NODE_ENV=production`); they are Local QA Only. Demonstrate the 24h unlock and missed-day reset locally, with the automated tests, or with the *Local QA Only* Postman folder against a local server. Run the *Production / Live Flow* folder against the deployed API.

---

## 16. Implementation decisions

The specification left these points open. Each choice is documented here.

| Topic | Decision |
| --- | --- |
| Streak day timing | Rolling window from the last claim (unlock after `claimIntervalMinutes`, miss after a further `claimWindowMinutes`) rather than calendar-midnight days. This matches the spec's "24-hour backend-controlled timer" and avoids time-zone ambiguity. |
| Streak count for a new user | Shown as **0** ("Start your streak") until Day 1 is claimed; after the claim it is 1, as in spec §8. A reset also returns to 0 (spec §50). |
| Card states (§29) | Two backend fields per card. `status` (`CLAIMED`/`AVAILABLE`/`LOCKED`) is claimability. `state` (`CLAIMED`/`TODAY`/`MISSED`/`LOCKED`) is the card state, so today's claimable day is `status: AVAILABLE` + `state: TODAY`. The missed day is `state: MISSED` on its card (and in the reset notice timeline). The waiting day is `LOCKED` + `isNext: true` + `unlocksAt`. |
| CPA demo | Two-phase claim with a server-side session and a minimum verification time (`cpaDemoSeconds`, default 5s). The real CPA integration can later replace the demo by marking the session verified. `requireCpaVerification: false` enables a direct single-call claim. |
| After Day 7 | The cycle completes and a new cycle starts at Day 1 once the interval passes. The streak count keeps growing. Missing the next Day 1 resets the count. |
| Gift-card rewards | Credited to `wallet.balances.INR` as gift-card value with a ledger entry. Issuing actual Amazon codes is out of scope. |
| Token storage | JWT in `localStorage` as a Bearer token, which is simple across Vercel/Render domains and works with Postman. The trade-offs are documented in SECURITY.md. No streak/reward data is stored client-side. |
| Mobile hero asset | `Mobile_Hero.png` contains baked-in text, so the banner is rebuilt as real, responsive React markup using the supplied calendar, coin and gift artwork. |
| Asset animation | Subtle CSS motion on the supplied artwork (floating crown/gift, gentle glow, twinkling sparkles, reveal on claim), with `prefers-reduced-motion` respected. No AI-generated video assets were needed. |

---

## 17. Known limitations

- **Deployment, live URLs and the demo video** must be produced from the intern's own Vercel/Render/Atlas accounts; the repository is ready for that (`render.yaml`, `vercel.json`, `.env.example`).
- On a **standalone** MongoDB (local development only), grants rely on unique indexes, optimistic locking and best-effort compensation instead of a transaction. A crash between steps could leave a claim without its ledger entry. Production refuses to start in this mode (`REQUIRE_TRANSACTIONS`).
- Rate limiting uses the in-memory store, so limits are per instance. Use a shared store (Redis) if the API is scaled horizontally.
- Missed days are detected when the user's state is next read; there is no background job. Results are identical because detection is purely timestamp based, but the `brokenAt` timestamp records the detection time, not the deadline. The deadline is stored in the audit log.
- JWTs cannot be revoked before expiry, and logout is client-side.
- The CPA/ad step is a demo placeholder by design (spec §68); no ad network is integrated.
