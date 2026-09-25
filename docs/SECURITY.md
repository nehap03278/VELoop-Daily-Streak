# Security — VELoop Daily Streak

**Principle:** the browser can be manipulated, so the frontend is never a source of truth. Every value that affects a reward is computed, validated and stored by the backend, using server time.

## 1. What the backend owns

| Value | Where it is decided |
| --- | --- |
| Current streak, current day, checked-in count | `streakCalculator.evaluate` from `userstreaks` + ledger |
| Claim eligibility and locked/available state | `evaluate` + `assertEligible` (server clock) |
| Reward type, currency, amount, title, asset | `streakrewards` collection |
| Unlock time / countdown target | `lastClaimAt + claimIntervalMinutes` |
| Missed-day detection and reset | `loadState` → `resetStreak` (compare-and-set) |
| User identity | Verified JWT (`req.user`) |
| Wallet balance and transactions | Atomic `$inc` + `wallettransactions` ledger |

The frontend stores **only the auth token**. It never persists or computes streak, reward or balance values, and it re-fetches `GET /api/daily-streak` after every claim.

## 2. Threats and mitigations

| Attack | Mitigation | Verified by |
| --- | --- | --- |
| Edit streak/day/claimed state in React DevTools or localStorage | UI state is display-only; every claim is re-validated server-side | Manual + `claim.test.js` |
| Send `{ "day": 7 }` while on Day 2 | Day derived by the server; mismatch → `403 DAY_NOT_ELIGIBLE` (+ `INVALID_CLAIM` audit) | `security.test.js`, Postman |
| `?day=7` in the query | Ignored | `security.test.js` |
| Send `{ "reward": 1000000, "amount": …, "currency": "INR", "streak": 7 }` | Fields stripped by zod, never read; configured reward granted; `TAMPERED_REQUEST` audit | `security.test.js`, Postman |
| Send `{ "userId": "otherUser" }` | Identity only from the JWT; body ignored | `security.test.js`, Postman |
| Confirm another user's claim session | Sessions looked up by `(sessionId, userId)` → `404` | `security.test.js`, Postman |
| Read another user's history | All queries scoped by `req.user._id`; no userId parameter exists | `security.test.js` |
| Change the device clock / send a fake `Date` header | Server clock only; client countdown anchored to `performance.now()` | `security.test.js` + browser test (Date.now +25h: countdown unchanged) |
| Claim a locked day | `409 REWARD_LOCKED` until `serverNow ≥ unlockAt` | `claim.test.js` |
| Skip the previous day | Claim ledger must contain day − 1 → `409 PREVIOUS_DAY_NOT_CLAIMED` | `security.test.js` |
| Double click / repeat request | Frontend guard (UX) + idempotent session replay + unique indexes (security) | `claim.test.js` |
| Concurrent requests (10 parallel, 5 tabs) | Unique `(userId, cycleId, day)` index, version CAS, session `PENDING→PROCESSING` lock, transactions | `concurrency.test.js` |
| Multiple tabs | Second tab's claim → `409 ALREADY_CLAIMED`; tabs re-sync via BroadcastChannel/focus | `concurrency.test.js` |
| Skip the ad / CPA step | Server enforces `readyAt`; confirm without a session → `400`, early → `425` | `claim.test.js`, Postman |
| Replay an old session after a reset | `STREAK_RESET` / `CLAIM_SESSION_STALE`; expired → `410` | `missedDay.test.js`, `claim.test.js` |
| Forged / expired / `alg:none` / malformed JWT | HS256 pinned via `algorithms`, `sub` validated as ObjectId, user loaded from the DB | `auth.test.js` |
| Suspended account | `403 ACCOUNT_SUSPENDED` | `security.test.js` |
| NoSQL operator injection (`{ "claimSessionId": { "$ne": null } }`) | zod type validation (UUID string) → `400` | `security.test.js` |
| Brute-force login | 20 attempts / 15 min per IP; generic error for unknown email or wrong password | `auth.test.js` |
| Error information leakage | Central handler returns generic messages; stack traces and Mongo/Cast/Axios errors are logged server-side only | `security.test.js` |

## 3. Authentication

- JWT signed with `JWT_SECRET` (HS256, algorithm pinned on verify), default expiry 7 days.
- Passwords are hashed with bcrypt at cost 12. Password hashes are excluded from queries by default (`select: false`).
- In production the server refuses to start without a secret of at least 32 characters.
- The token is sent as `Authorization: Bearer`. It is stored in `localStorage` because the SPA and API are on different domains (Vercel/Render); this is simple and works with Postman. **Trade-off:** an XSS bug could read the token. That risk is reduced by React's escaping, the absence of `dangerouslySetInnerHTML`, and Helmet headers on the API. A stricter deployment could switch to an httpOnly `SameSite=None; Secure` cookie plus CSRF protection.

## 4. Transport and API hardening

- `helmet()` security headers; `x-powered-by` disabled.
- CORS allow-list from `CLIENT_URL` (required in production, trailing slashes normalised); only `GET`/`POST` and the `Content-Type`/`Authorization` headers are allowed. Other origins get no CORS headers.
- Static frontend security headers via `frontend/vercel.json` / `public/_headers` (nosniff, frame denial, referrer policy).
- JSON body limit of 10 kb.
- `Cache-Control: no-store` on every `/api` response.
- Rate limits: auth 20/15 min (IP), claims 20/min (user), other reads 120/min (user). Set `TRUST_PROXY=true` (or a hop count) behind a proxy; the API warns at startup in production if it is unset.

## 5. Data integrity

- Unique indexes: `streakclaims(userId, cycleId, day)`, `streakclaims.claimSessionId`, `wallettransactions.referenceId`, `wallettransactions.transactionId`, `userstreaks.userId`, `wallets.userId`, and one ACTIVE cycle per user.
- Optimistic locking (`userstreaks.version`) on every claim and reset.
- Atomic wallet `$inc`; the ledger stores `balanceBefore/After` from the post-image.
- Multi-document transactions on replica sets, with compensation on standalone servers.
- Reward snapshot on every claim, so the history is immutable.

## 6. Audit trail

`auditlogs` records `STREAK_CLAIM_REQUEST`, `STREAK_CLAIM_SUCCESS`, `STREAK_CLAIM_REJECTED`, `STREAK_RESET`, `DUPLICATE_CLAIM`, `INVALID_CLAIM`, `TAMPERED_REQUEST`, `STREAK_CYCLE_COMPLETED`, `USER_LOGIN(_FAILED)`, `USER_REGISTERED`, and the `DEV_*` events, with IP, user agent and metadata. Audit writes never break the request they describe.

## 7. Secrets and environments

- Only `.env.example` files are committed; `.env` and `.env.*` are git-ignored. No credential or secret is hard-coded. The only fallbacks (local MongoDB URI, dev JWT secret, localhost CORS origin) apply **only** when `NODE_ENV` is explicitly `development` or `test`.
- **Unset `NODE_ENV` means production.** The API then refuses to start without `MONGO_URI`, a ≥ 32-character `JWT_SECRET` and `CLIENT_URL`.
- **Dev tools are hard-disabled in production:** `ENABLE_DEV_TOOLS=true` is ignored unless `NODE_ENV` is `development`/`test`. The routes only ever affect the caller's own records.
- **Transactions are required in production** (`REQUIRE_TRANSACTIONS`, default `true` in production). The API refuses to start on a standalone MongoDB, so the local compensation path can never serve production traffic.
- The frontend bundle contains only the public API URL (`VITE_API_URL`) and the published demo credentials (a spec deliverable), never a backend secret. A production build fails if `VITE_API_URL` is missing.
- No production credentials are used or needed. Use your own Atlas development cluster and deployment.

## 8. Final quality checklist (spec §121)

| Question | Answer |
| --- | --- |
| Can I change my streak using DevTools? | **No** |
| Can I send a fake reward amount? | **No** — ignored, configured amount granted |
| Can I change my phone/PC clock and claim early? | **No** — server clock only |
| Can I directly request Day 7? | **No** — `DAY_NOT_ELIGIBLE` |
| Can I claim the same day twice? | **No** — idempotent replay / `ALREADY_CLAIMED`, unique index |
| Does a genuinely missed streak reset correctly? | **Yes** |
| Can I see the claim and reward transaction in MongoDB? | **Yes** — see DATABASE.md |
