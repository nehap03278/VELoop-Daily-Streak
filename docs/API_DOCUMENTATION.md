# API Documentation — VELoop Daily Streak

Base URL: `http://localhost:5000/api` (local), or `https://<your-api-domain>/api` when deployed.

All responses are JSON. Every successful response has `"success": true`. Streak responses also include `serverTime`, the trusted server clock that all decisions are based on.

## Authentication

Protected endpoints require `Authorization: Bearer <JWT>`. The user is identified **only** from the token. Any `userId` sent in a body or query string is ignored.

## Error format

```json
{
  "success": false,
  "error": { "code": "REWARD_LOCKED", "message": "Your next reward is not available yet.", "details": { "nextClaimAt": "2026-09-26T08:45:14.300Z", "day": 2 } },
  "serverTime": "2026-09-25T08:46:00.000Z"
}
```

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body/query failed validation (details lists fields) |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 400 | `INVALID_DAY` | Requested day does not exist in the configured cycle |
| 400 | `DAY_MISMATCH` | `day` in the confirm call differs from the claim session's day |
| 400 | `CPA_VERIFICATION_REQUIRED` | `POST /claim` without `claimSessionId` while CPA verification is required |
| 401 | `UNAUTHORIZED` | Missing, invalid, forged or expired token — "Please log in to continue." |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `ACCOUNT_SUSPENDED` / `ACCOUNT_INELIGIBLE` | Account cannot claim rewards |
| 403 | `DAY_NOT_ELIGIBLE` | Tried to claim a future day (e.g. Day 7 while on Day 2) |
| 404 | `CLAIM_SESSION_NOT_FOUND` | Unknown session, or one that belongs to another user |
| 409 | `ALREADY_CLAIMED` | "This reward has already been claimed." |
| 409 | `REWARD_LOCKED` | "Your next reward is not available yet." (`details.nextClaimAt`) |
| 409 | `STREAK_RESET` | "Your streak has been reset. Start again from Day 1." |
| 409 | `PREVIOUS_DAY_NOT_CLAIMED` | Ledger does not contain the previous day's claim |
| 409 | `CLAIM_IN_PROGRESS` / `CLAIM_CONFLICT` / `CLAIM_SESSION_STALE` / `CLAIM_SESSION_CLOSED` | Concurrent or outdated claim attempt |
| 409 | `EMAIL_IN_USE` | Registration with an existing email |
| 410 | `CLAIM_SESSION_EXPIRED` | Claim session older than `claimSessionTtlMinutes` |
| 425 | `CPA_NOT_COMPLETED` | Confirm called before the server-side CPA demo time elapsed (`details.readyAt`) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Generic, sanitised message — internals are never exposed |
| 503 | `STREAK_NOT_CONFIGURED` | Reward configuration missing or invalid in the database |

---

## Auth

### POST /auth/register

```json
{ "name": "Asha", "email": "asha@example.com", "password": "Passw0rd!" }
```

Password: 8–128 characters with at least one letter and one number. Returns **201**: `{ "success": true, "token": "…", "user": { "id", "name", "email", "status", "createdAt" } }`. It also creates the user's wallet and streak.

### POST /auth/login

```json
{ "email": "demo@veloop.in", "password": "Demo@1234" }
```

Returns **200** `{ success, token, user }`. Rate limited to 20 requests per 15 minutes per IP.

### GET /auth/me

Returns `{ success, user }` for the token owner.

---

## Daily Streak

### GET /daily-streak

Returns the full page state. The response is computed on the server, and a missed day is detected and reset here if needed.

```json
{
  "success": true,
  "serverTime": "2026-09-25T08:45:14.696Z",
  "user": { "id": "6ab63494af4de1dc4320083f", "name": "Wide User" },
  "wallet": { "VES": 5, "INR": 0 },
  "streak": {
    "status": "ACTIVE",               // NEW | ACTIVE | RESET
    "currentStreak": 1,
    "longestStreak": 1,
    "currentDay": 2,                  // the user's actionable day (derived by the server)
    "checkedIn": 1,                   // claims in the displayed cycle
    "totalRewards": 7,                // number of configured reward days
    "cycleNumber": 1,
    "cycleCompleted": false,          // true while a finished cycle waits for the next Day 1
    "claimable": false,
    "nextClaimAt": "2026-09-26T08:45:14.300Z",     // null when claimable
    "streakExpiresAt": "2026-09-27T08:45:14.300Z", // claim deadline to keep the streak
    "lastClaimAt": "2026-09-25T08:45:14.300Z",
    "totalClaims": 1
  },
  "stats": {
    "totalRewards": 7,
    "checkedIn": 1,
    "nextReward": { "day": 2, "rewardType": "VES", "currency": "VES", "amount": 10, "displayValue": "+10", "subtitle": "10 VEs", "…": "…" }
  },
  "ultimateReward": {
    "day": 7, "rewardType": "GIFT_CARD", "currency": "INR", "amount": 5, "displayValue": "₹5",
    "title": "Ultimate Reward", "subtitle": "Amazon Gift Card", "assetType": "crown", "badge": "VIP",
    "isUltimate": true, "provider": "Amazon", "unlockDay": 7, "status": "LOCKED", "state": "LOCKED"
  },
  "rewards": [
    { "day": 1, "status": "CLAIMED", "state": "CLAIMED", "isToday": false, "isNext": false, "claimedAt": "2026-09-25T08:45:14.300Z", "unlocksAt": null,
      "reward": { "id": "…", "day": 1, "rewardType": "VES", "currency": "VES", "amount": 5, "displayValue": "+5", "title": "Daily Reward", "subtitle": "5 VEs", "assetType": "coin", "badge": null, "isUltimate": false } },
    { "day": 2, "status": "LOCKED", "state": "LOCKED", "isToday": false, "isNext": true, "claimedAt": null, "unlocksAt": "2026-09-26T08:45:14.300Z", "reward": { "…": "…" } },
    { "day": 3, "status": "LOCKED", "state": "LOCKED", "isToday": false, "isNext": false, "claimedAt": null, "unlocksAt": null, "reward": { "…": "…" } }
  ],
  "resetNotice": null,
  "cpa": { "required": true, "durationSeconds": 5 },
  "rules": { "claimIntervalMinutes": 1440, "claimWindowMinutes": 1440 }
}
```

#### Card `status` and `state`

Every day card (and `ultimateReward`) carries two backend-decided fields. **The backend determines both**; the frontend only renders them.

`status` is the claimability flag. It drives the claim button (spec §34):

| `status` | Meaning |
| --- | --- |
| `CLAIMED` | Claimed in this cycle (`claimedAt`) |
| `AVAILABLE` | Can be claimed now; the frontend shows *Claim Reward* |
| `LOCKED` | Not claimable. The waiting day also has `isNext: true` and `unlocksAt`. |

`state` is the card state (spec §29) and drives how the card looks:

| `state` | Meaning | `status` on the same card |
| --- | --- | --- |
| `CLAIMED` | Claimed in this cycle | `CLAIMED` |
| `TODAY` | Today's actionable streak day, claimable now | `AVAILABLE` |
| `MISSED` | The day whose claim window passed and broke the previous streak. Shown until the user claims again after the reset. | `LOCKED` |
| `LOCKED` | Not claimable yet, including the day waiting on the countdown (`isNext: true`) | `LOCKED` |

So `AVAILABLE` appears in `status` and `TODAY` appears in `state` on the same card:

```json
{ "day": 2, "status": "AVAILABLE", "state": "TODAY", "isToday": true, "isNext": false, "claimedAt": null, "unlocksAt": null, "reward": { "…": "…" } }
```

After a missed day, the missed card is explicitly `MISSED` and cannot be claimed:

```json
{ "day": 3, "status": "LOCKED", "state": "MISSED", "isToday": false, "isNext": false, "claimedAt": null, "unlocksAt": null, "reward": { "…": "…" } }
```

For example, after Day 1 and Day 2 were claimed and Day 3 was missed, the seven cards' `state` values are `TODAY, LOCKED, MISSED, LOCKED, LOCKED, LOCKED, LOCKED`. Day 1 is claimable again immediately.

**Day 1 exception:** if the missed day was Day 1 (for example, the first day of a new cycle after Day 7), that day is immediately claimable again. Its card is therefore `status: "AVAILABLE"`, `state: "TODAY"`, not `MISSED`. The miss is still recorded in `resetNotice` (`missedDay: 1`) and shown in the reset banner.

After a missed day, `resetNotice` has this shape (its timeline also marks the missed day `MISSED`):

```json
"resetNotice": {
  "at": "2026-09-28T09:00:00.000Z", "missedDay": 3, "previousStreak": 2, "claimedDays": 2,
  "message": "Your streak has been reset. Start again from Day 1.",
  "days": [ { "day": 1, "status": "CLAIMED" }, { "day": 2, "status": "CLAIMED" }, { "day": 3, "status": "MISSED" }, { "day": 4, "status": "LOCKED" } ]
}
```

### GET /daily-streak/status

A lightweight version, used by the home page and suitable for polling. Returns `{ success, serverTime, streak }`, where `streak` has the same shape as above. It also applies missed-day resets.

### POST /daily-streak/claim/start

Phase 1: the backend validates eligibility and opens a CPA/ad verification session. **Nothing is granted.**

Body (all optional; only `day` is read):

```json
{ "day": 2 }
```

If `day` is given it must equal the server-derived current day. Any other fields (`reward`, `amount`, `currency`, `streak`, `userId`, …) are ignored and recorded as a `TAMPERED_REQUEST` audit event.

**202 Accepted**

```json
{
  "success": true,
  "cpaRequired": true,
  "serverTime": "2026-09-25T08:03:09.794Z",
  "claimSession": { "id": "58a04dda-6fe6-4003-848d-fb0d8ce14e97", "day": 1, "cycleNumber": 1,
                    "readyAt": "2026-09-25T08:03:14.794Z", "expiresAt": "2026-09-25T08:13:09.794Z", "durationSeconds": 5 },
  "reward": { "day": 1, "rewardType": "VES", "amount": 5, "displayValue": "+5", "…": "…" }
}
```

If the configuration has `requireCpaVerification: false`, this call grants directly and returns **200** with the claim result, the same shape as below.

Errors: `REWARD_LOCKED`, `ALREADY_CLAIMED`, `DAY_NOT_ELIGIBLE`, `INVALID_DAY`, `STREAK_RESET`, `PREVIOUS_DAY_NOT_CLAIMED`, `ACCOUNT_*`, `VALIDATION_ERROR`, `RATE_LIMITED`.

### POST /daily-streak/claim

Phase 2: after the CPA demo, the backend re-runs every check and grants the configured reward exactly once.

```json
{ "claimSessionId": "58a04dda-6fe6-4003-848d-fb0d8ce14e97" }
```

**200 OK**

```json
{
  "success": true,
  "claim": { "claimId": "CLM-AEDPCA6BWWEC", "day": 1, "cycleNumber": 1, "claimedAt": "2026-09-25T08:03:15.108Z", "referenceId": "STREAK-X8HKG4GV", "status": "COMPLETED" },
  "reward": { "day": 1, "rewardType": "VES", "currency": "VES", "amount": 5, "displayValue": "+5", "…": "…" },
  "transaction": { "transactionId": "TXN-HMWSJHEV8URG", "referenceId": "STREAK-X8HKG4GV", "source": "DAILY_STREAK", "rewardType": "VES",
                   "amount": 5, "currency": "VES", "balanceBefore": 100, "balanceAfter": 105 },
  "wallet": { "VES": 105, "INR": 0 },
  "streak": { "currentStreak": 1, "nextClaimAt": "2026-09-26T08:03:15.108Z", "cycleCompleted": false },
  "serverTime": "2026-09-25T08:03:15.108Z",
  "idempotent": false
}
```

Repeating the call with the same `claimSessionId` returns the same body with `"idempotent": true`, and **no second credit** is made. After a success the client should call `GET /daily-streak` to refresh the whole UI.

Errors: `CPA_NOT_COMPLETED` (425), `CLAIM_SESSION_NOT_FOUND` (404), `CLAIM_SESSION_EXPIRED` (410), `ALREADY_CLAIMED`, `CLAIM_IN_PROGRESS`, `CLAIM_CONFLICT`, `CLAIM_SESSION_STALE`, `STREAK_RESET`, `DAY_MISMATCH`, `CPA_VERIFICATION_REQUIRED`.

### GET /daily-streak/history?page=1&limit=20

`limit` ≤ 50.

```json
{
  "success": true,
  "serverTime": "2026-09-25T08:45:14.869Z",
  "claims": [
    { "claimId": "CLM-7BDNZQUVWDMG", "day": 1, "cycleNumber": 1, "status": "COMPLETED", "claimedAt": "2026-09-25T08:45:14.300Z",
      "reward": { "rewardType": "VES", "currency": "VES", "amount": 5, "title": "Daily Reward", "subtitle": "5 VEs", "displayValue": "+5" },
      "transactionId": "TXN-SZE79ZTHGFQW", "referenceId": "STREAK-V4PESN8C" }
  ],
  "cycles": [
    { "cycleNumber": 1, "status": "ACTIVE", "totalDays": 7, "claimedDays": 1, "startedAt": "2026-09-25T08:45:08.893Z",
      "completedAt": null, "brokenAt": null, "missedDay": null }
  ],
  "page": 1, "limit": 20, "total": 1
}
```

---

## Wallet

### GET /wallet

```json
{ "success": true, "serverTime": "…", "wallet": { "balances": { "VES": 105, "INR": 0 } } }
```

### GET /wallet/transactions?page=1&limit=20

```json
{
  "success": true,
  "items": [
    { "transactionId": "TXN-HMWSJHEV8URG", "type": "CREDIT", "rewardType": "VES", "amount": 5, "currency": "VES", "source": "DAILY_STREAK",
      "description": "Daily streak Day 1 - 5 VEs", "streakDay": 1, "cycleNumber": 1, "referenceId": "STREAK-X8HKG4GV",
      "balanceBefore": 100, "balanceAfter": 105, "status": "COMPLETED", "createdAt": "2026-09-25T08:03:15.120Z" }
  ],
  "page": 1, "limit": 20, "total": 2
}
```

---

## Development / QA endpoints

These routes are mounted **only** when `ENABLE_DEV_TOOLS=true` **and** `NODE_ENV` is `development` or `test`. In production they always return 404. They act only on the authenticated caller's own data, and never change server time or other users.

| Method | Path | Body | Effect |
| --- | --- | --- | --- |
| POST | `/dev/time-travel` | `{ "hours": 24 }` (0 < h ≤ 720) | Moves the caller's stored claim timestamps back by *h* hours, simulating time passing, then returns `/status` |
| POST | `/dev/reset-my-streak` | `{}` | Deletes the caller's streak, cycles, claims and sessions. The wallet ledger is kept. |

## Rate limits

| Scope | Limit |
| --- | --- |
| `/auth/login`, `/auth/register` | 20 / 15 min per IP |
| `/daily-streak/claim*` | 20 / min per user |
| Other authenticated reads | 120 / min per user |

Rate-limit headers follow the IETF draft-7 `RateLimit` format.
