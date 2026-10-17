# Database Design — VELoop Daily Streak

MongoDB accessed through Mongoose. Indexes are synced at startup (`syncIndexes`) because several of them are **integrity guarantees**, not just optimisations.

```
User 1──1 Wallet 1──* WalletTransaction
 │                         ▲ transactionId / referenceId
 1                         │
UserStreak ──activeCycleId──▶ StreakCycle 1──* StreakClaim ──rewardId──▶ StreakReward
 │                                                   ▲ claimSessionId
 └─────────────────────────────── ClaimSession ──────┘
StreakConfig (singleton)          AuditLog (events for every user)
```

After a successful claim the chain **StreakClaim → StreakReward → WalletTransaction → Wallet** can be followed directly in MongoDB:

```js
const claim = db.streakclaims.findOne({ referenceId: 'STREAK-X8HKG4GV' });
db.streakrewards.findOne({ _id: claim.rewardId });
db.wallettransactions.findOne({ transactionId: claim.transactionId });   // balanceBefore / balanceAfter
db.wallets.findOne({ userId: claim.userId });
db.auditlogs.find({ userId: claim.userId }).sort({ createdAt: -1 });
```

---

## users

| Field | Type | Notes |
| --- | --- | --- |
| name | String | 2–60 chars |
| email | String | **unique**, lower-cased |
| passwordHash | String | bcrypt (12 rounds), `select: false` |
| status | `ACTIVE` \| `SUSPENDED` | Only ACTIVE accounts can claim |
| role | `USER` \| `ADMIN` | |
| lastLoginAt, createdAt, updatedAt | Date | |

## wallets

| Field | Type | Notes |
| --- | --- | --- |
| userId | ObjectId → users | **unique** |
| balances.VES | Number ≥ 0 | VEs points (header gem balance) |
| balances.INR | Number ≥ 0 | Accumulated Amazon gift-card value |

Balances are only changed with atomic `$inc`.

## streakconfigs (singleton, `key: "default"`)

| Field | Seed value | Purpose |
| --- | --- | --- |
| claimIntervalMinutes | 1440 | Wait after a claim before the next day unlocks |
| claimWindowMinutes | 1440 | Time after unlock before the day counts as missed |
| cpaDemoSeconds | 5 | Minimum server-enforced CPA/ad verification time |
| claimSessionTtlMinutes | 10 | Claim session lifetime |
| requireCpaVerification | false | `false` enables single-call claims |
| resetRule | `RESET_TO_DAY_1` | Rule applied on a missed day |
| cycleCompletionRule | `START_NEW_CYCLE` | Rule applied after the last day |
| active | true | |

## streakrewards

| Field | Type | Notes |
| --- | --- | --- |
| day | Number | **unique among active rewards** (partial index). Active days must be contiguous 1..N; N is the cycle length. |
| rewardType | `VES` \| `GIFT_CARD` | |
| currency | `VES` \| `INR` | |
| amount | Number | |
| title / subtitle / description | String | e.g. "Daily Reward" / "10 VEs" |
| assetType | `coin` \| `gift-box` \| `gift-card` \| `crown` | Identifier only; the image lives in the frontend |
| badge | String \| null | "Gift Card", "Coin", "VIP" |
| isUltimate | Boolean | Drives the Ultimate Reward section |
| active | Boolean | Inactive rewards are ignored |
| metadata | Mixed | e.g. `{ provider: "Amazon" }` |

## userstreaks — authoritative streak state

| Field | Type | Notes |
| --- | --- | --- |
| userId | ObjectId | **unique** |
| activeCycleId | ObjectId → streakcycles | |
| cycleNumber | Number | |
| currentStreak / longestStreak | Number | |
| lastClaimedDay | Number | Highest claimed day in the active cycle (0 = none) |
| lastClaimAt | Date | Server time of the last successful claim |
| totalClaims | Number | |
| lastReset | `{ at, missedDay, previousStreak, claimedDays, cycleNumber }` \| null | Source of the reset notice |
| version | Number | **Optimistic lock**: every claim or reset is a compare-and-set on `version` |

## streakcycles

| Field | Type | Notes |
| --- | --- | --- |
| userId, cycleNumber | | **unique (userId, cycleNumber)** |
| status | `ACTIVE` \| `COMPLETED` \| `BROKEN` | **Partial unique index**: at most one ACTIVE cycle per user |
| totalDays, claimedDays | Number | |
| startedAt, lastClaimAt, completedAt, brokenAt | Date | |
| missedDay | Number \| null | Set when BROKEN |

## streakclaims — check-in history

| Field | Type | Notes |
| --- | --- | --- |
| claimId | String `CLM-…` | unique |
| userId, cycleId, cycleNumber, day | | **unique (userId, cycleId, day)**, the core duplicate-claim guard |
| rewardId | ObjectId → streakrewards | |
| reward | snapshot `{ rewardType, currency, amount, title, subtitle }` | History does not change if the config changes later |
| status | `COMPLETED` | |
| claimedAt | Date | Server time |
| transactionId, referenceId | String | Link to the ledger |
| claimSessionId | String \| null | **unique when set**; one grant per CPA session |

## claimsessions — CPA verification and idempotency

| Field | Type | Notes |
| --- | --- | --- |
| sessionId | UUID | unique; the idempotency key for `POST /claim` |
| userId, cycleNumber, day, rewardId | | What was validated in phase 1 |
| status | `PENDING` → `PROCESSING` → `COMPLETED` \| `REJECTED` | The PENDING→PROCESSING transition is atomic |
| readyAt | Date | Earliest confirm time (server clock) |
| expiresAt | Date | TTL index removes documents 24h after expiry |
| result | Mixed | Stored claim result returned on idempotent replays |
| rejectionCode | String | |

## wallettransactions — ledger (append-only)

| Field | Type | Notes |
| --- | --- | --- |
| transactionId | String `TXN-…` | unique |
| userId | ObjectId | indexed with createdAt |
| rewardType, currency, type (`CREDIT`/`DEBIT`), amount | | |
| source | `DAILY_STREAK` \| `WELCOME_BONUS` | |
| streakDay, cycleNumber, claimId | | Streak linkage |
| referenceId | String `STREAK-XXXXXXXX` | **unique**, so a grant can't be booked twice |
| balanceBefore, balanceAfter | Number | Derived from the atomic `$inc` post-image |
| status | `COMPLETED` | |
| createdAt | Date | |

## auditlogs

| Field | Notes |
| --- | --- |
| event | `USER_REGISTERED`, `USER_LOGIN`, `USER_LOGIN_FAILED`, `STREAK_CLAIM_REQUEST`, `STREAK_CLAIM_SUCCESS`, `STREAK_CLAIM_REJECTED`, `STREAK_RESET`, `STREAK_CYCLE_COMPLETED`, `DUPLICATE_CLAIM`, `INVALID_CLAIM`, `TAMPERED_REQUEST`, `DEV_TIME_TRAVEL`, `DEV_STREAK_RESET` |
| userId, ip, userAgent | Request context |
| metadata | e.g. rejection code, ignored tampered fields, missed day + deadline |

---

## Streak cycle approach

Each cycle is a `streakcycles` document, and claims belong to exactly one cycle.

```
Cycle 1  ACTIVE     Day1 ✓ Day2 ✓ Day3 ✓ …
          │ Day 7 claimed                     │ Day missed
          ▼                                   ▼
Cycle 1  COMPLETED  (next claim opens 2)     Cycle 1  BROKEN (missedDay=4) → Cycle 2 ACTIVE, streak = 0
```

- **Completion:** the completed cycle stays displayed until the next Day 1 unlocks. The next claim creates cycle *n + 1* inside the same transaction as the claim.
- **Missed day:** `userstreaks` is reset with a compare-and-set, the old cycle becomes `BROKEN` (or stays `COMPLETED` if the miss was the first day after a completed cycle), and a new `ACTIVE` cycle is created.

## Transactions

`config/db.js` detects whether the deployment supports multi-document transactions, using `hello.setName` (replica set) or `isdbgrid` (sharded):

- **Replica set / Atlas:** the claim grant (claim, streak, wallet, ledger, cycle, session) and the reset run inside `session.withTransaction`. Write conflicts between concurrent claims are retried by the driver, and the retry then fails the version or unique checks.
- **Standalone:** the same operations run in order. Unique indexes and the version compare-and-set still prevent double grants, and a failure after the first write triggers compensation (delete the claim, restore the streak version, reverse the credit, delete the ledger row).

Both modes are covered by the same test suite (`npm test`, `npm run test:replset`).
