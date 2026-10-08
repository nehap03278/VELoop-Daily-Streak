// Generates VELoop_Daily_Streak.postman_collection.json. Run: node build-collection.js
const fs = require('fs');

function url(path) {
  const [pathname, query] = path.split('?');
  return {
    raw: `{{baseUrl}}${path}`,
    host: ['{{baseUrl}}'],
    path: pathname.split('/').filter(Boolean),
    ...(query ? { query: query.split('&').map((kv) => ({ key: kv.split('=')[0], value: kv.split('=')[1] })) } : {}),
  };
}

function req(name, method, path, { body, auth = '{{token}}', tests = [], pre = [], description } = {}) {
  return {
    name,
    event: [
      ...(pre.length ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } }] : []),
      ...(tests.length ? [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] : []),
    ],
    request: {
      method,
      ...(description ? { description } : {}),
      header: [
        ...(body !== undefined ? [{ key: 'Content-Type', value: 'application/json' }] : []),
        ...(auth ? [{ key: 'Authorization', value: `Bearer ${auth}` }] : []),
      ],
      ...(body !== undefined ? { body: { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2) } } : {}),
      url: url(path),
    },
  };
}

const status = (c) => `pm.test('status ${c}', () => pm.response.to.have.status(${c}));`;
const code = (c) => `pm.test('error code ${c}', () => pm.expect(pm.response.json().error.code).to.eql('${c}'));`;
// The server only accepts the confirmation once the CPA demo time (readyAt) has passed.
const WAIT_CPA = ['// Wait for the server-side CPA demo window (cpaDemoSeconds = 5).', 'setTimeout(() => {}, 5500);'];

/* ------------------------------------------------------------------------------------------------
 * Production / Live Flow - only public endpoints; safe to run against the deployed API.
 * A fresh user is registered on every run, so the flow is repeatable without any dev tooling.
 * ---------------------------------------------------------------------------------------------- */
const liveFlow = {
  name: 'Production / Live Flow',
  description:
    'Runs against any environment, including the deployed production API (set `baseUrl`). Registers a fresh user each run, ' +
    'claims Day 1 through the CPA flow and runs the security/negative tests that do not need time travel. ' +
    'Requires the seeded demo users for the cross-user test. Contains no /api/dev requests.',
  item: [
    {
      name: '1. Auth',
      item: [
        req('Register (fresh user)', 'POST', '/auth/register', {
          auth: null,
          pre: ["pm.collectionVariables.set('liveEmail', `qa.${Date.now()}@example.com`);"],
          body: { name: 'Postman QA', email: '{{liveEmail}}', password: 'Passw0rd!' },
          tests: [status(201), "pm.collectionVariables.set('token', pm.response.json().token);"],
        }),
        req('Login (fresh user)', 'POST', '/auth/login', {
          auth: null,
          body: { email: '{{liveEmail}}', password: 'Passw0rd!' },
          tests: [status(200), "pm.collectionVariables.set('token', pm.response.json().token);"],
        }),
        req('Login (second demo user)', 'POST', '/auth/login', {
          auth: null,
          body: { email: 'demo2@veloop.in', password: 'Demo@1234' },
          tests: [status(200), "pm.collectionVariables.set('token2', pm.response.json().token);"],
        }),
        req('Me', 'GET', '/auth/me', {
          tests: [status(200), "pm.test('token owner', () => pm.expect(pm.response.json().user.email).to.eql(pm.collectionVariables.get('liveEmail')));"],
        }),
        req('[neg] Wrong password', 'POST', '/auth/login', {
          auth: null,
          body: { email: 'demo@veloop.in', password: 'wrong-pass1' },
          tests: [status(401), code('INVALID_CREDENTIALS')],
        }),
      ],
    },
    {
      name: '2. Claim Day 1',
      item: [
        req('Get streak', 'GET', '/daily-streak', {
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('backend provides serverTime', () => pm.expect(d.serverTime).to.be.a('string'));",
            "pm.test('7 reward cards from DB config', () => pm.expect(d.rewards).to.have.length(7));",
            "pm.test('Day 1 AVAILABLE', () => pm.expect(d.rewards[0].status).to.eql('AVAILABLE'));",
            "pm.test('Day 1 state TODAY (backend-decided)', () => pm.expect(d.rewards[0].state).to.eql('TODAY'));",
            "pm.test('future days LOCKED', () => pm.expect(d.rewards.slice(1).every((c) => c.state === 'LOCKED')).to.eql(true));",
            "pm.collectionVariables.set('walletBefore', d.wallet.VES);",
          ],
        }),
        req('Get status', 'GET', '/daily-streak/status', {
          tests: [status(200), "pm.test('current day 1', () => pm.expect(pm.response.json().streak.currentDay).to.eql(1));"],
        }),
        req('[neg] Jump to Day 7', 'POST', '/daily-streak/claim/start', { body: { day: 7 }, tests: [status(403), code('DAY_NOT_ELIGIBLE')] }),
        req('Claim Day 1 - start (with fake reward/streak/user fields)', 'POST', '/daily-streak/claim/start', {
          body: { day: 1, reward: 1000000, amount: 100000, currency: 'INR', streak: 7, userId: 'anotherUser' },
          description: 'All tampering fields are ignored (and audit-logged as TAMPERED_REQUEST); only the backend-configured reward is granted.',
          tests: [
            status(202),
            "const s = pm.response.json().claimSession; pm.test('day 1', () => pm.expect(s.day).to.eql(1)); pm.collectionVariables.set('sessionId', s.id);",
          ],
        }),
        req('[neg] Confirm before CPA finished', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          tests: [status(425), code('CPA_NOT_COMPLETED')],
        }),
        req('[neg] Other user cannot confirm this session', 'POST', '/daily-streak/claim', {
          auth: '{{token2}}',
          body: { claimSessionId: '{{sessionId}}' },
          pre: WAIT_CPA,
          tests: [status(404), code('CLAIM_SESSION_NOT_FOUND')],
        }),
        req('Claim Day 1 - confirm', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('fake reward ignored: configured +5 VEs', () => { pm.expect(d.transaction.amount).to.eql(5); pm.expect(d.transaction.currency).to.eql('VES'); });",
            "pm.test('ledger balances', () => pm.expect(d.transaction.balanceAfter - d.transaction.balanceBefore).to.eql(5));",
            "pm.test('reference id', () => pm.expect(d.claim.referenceId).to.match(/^STREAK-/));",
            "pm.test('real streak = 1 (fake streak ignored)', () => pm.expect(d.streak.currentStreak).to.eql(1));",
          ],
        }),
        req('[neg] Duplicate confirm (idempotent)', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          tests: [status(200), "pm.test('idempotent replay, no new credit', () => pm.expect(pm.response.json().idempotent).to.eql(true));"],
        }),
        req('Verify Day 1 (updated streak)', 'GET', '/daily-streak', {
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('Day 1 CLAIMED', () => { pm.expect(d.rewards[0].status).to.eql('CLAIMED'); pm.expect(d.rewards[0].state).to.eql('CLAIMED'); });",
            "pm.test('Day 2 LOCKED with nextClaimAt', () => { pm.expect(d.rewards[1].status).to.eql('LOCKED'); pm.expect(d.rewards[1].state).to.eql('LOCKED'); pm.expect(d.streak.nextClaimAt).to.be.a('string'); });",
            "pm.test('wallet credited exactly once', () => pm.expect(d.wallet.VES).to.eql(Number(pm.collectionVariables.get('walletBefore')) + 5));",
          ],
        }),
        req('[neg] Claim locked Day 2', 'POST', '/daily-streak/claim/start', { body: {}, tests: [status(409), code('REWARD_LOCKED')] }),
        req('[neg] Re-claim Day 1', 'POST', '/daily-streak/claim/start', { body: { day: 1 }, tests: [status(409), code('ALREADY_CLAIMED')] }),
        req('Get history', 'GET', '/daily-streak/history?page=1&limit=10', {
          tests: [status(200), "pm.test('latest claim is Day 1', () => pm.expect(pm.response.json().claims[0].day).to.eql(1));"],
        }),
      ],
    },
    {
      name: '3. Security / validation',
      item: [
        req('[neg] No token', 'GET', '/daily-streak', { auth: null, tests: [status(401), code('UNAUTHORIZED')] }),
        req('[neg] Forged token', 'GET', '/daily-streak', {
          auth: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYifQ.invalidsignature',
          tests: [status(401)],
        }),
        req('[neg] Invalid day type', 'POST', '/daily-streak/claim/start', { body: { day: 'abc' }, tests: [status(400), code('VALIDATION_ERROR')] }),
        req('[neg] Malformed JSON', 'POST', '/daily-streak/claim/start', { body: '{"day": 1,', tests: [status(400), code('INVALID_JSON')] }),
        req('[neg] Missing CPA session', 'POST', '/daily-streak/claim', { body: {}, tests: [status(400), code('CPA_VERIFICATION_REQUIRED')] }),
      ],
    },
    {
      name: '4. Wallet',
      item: [
        req('Get wallet', 'GET', '/wallet', {
          tests: [status(200), "pm.test('VEs balance from backend', () => pm.expect(pm.response.json().wallet.balances.VES).to.eql(Number(pm.collectionVariables.get('walletBefore')) + 5));"],
        }),
        req('Get transactions', 'GET', '/wallet/transactions?page=1&limit=10', {
          tests: [status(200), "pm.test('ledger has streak credits', () => pm.expect(pm.response.json().items.some((t) => t.source === 'DAILY_STREAK')).to.eql(true));"],
        }),
      ],
    },
  ],
};

/* ------------------------------------------------------------------------------------------------
 * Local QA Only - uses /api/dev/* (time travel), which only exists in local development.
 * ---------------------------------------------------------------------------------------------- */
const localQa = {
  name: 'Local QA Only',
  description:
    'Requires the LOCAL development environment: backend started with NODE_ENV=development and ENABLE_DEV_TOOLS=true. ' +
    'These requests use /api/dev/* to reset the demo account and simulate time passing (24h unlock, missed day). ' +
    'In production the /api/dev routes are intentionally not mounted and return 404, so do not run this folder against the live API.',
  item: [
    {
      name: '1. Setup',
      item: [
        req('Login (demo user)', 'POST', '/auth/login', {
          auth: null,
          body: { email: 'demo@veloop.in', password: 'Demo@1234' },
          tests: [status(200), "pm.collectionVariables.set('token', pm.response.json().token);"],
        }),
        req('Login (second demo user)', 'POST', '/auth/login', {
          auth: null,
          body: { email: 'demo2@veloop.in', password: 'Demo@1234' },
          tests: [status(200), "pm.collectionVariables.set('token2', pm.response.json().token);"],
        }),
        req('Me', 'GET', '/auth/me', {
          tests: [status(200), "pm.test('email', () => pm.expect(pm.response.json().user.email).to.eql('demo@veloop.in'));"],
        }),
        req('Reset my streak (dev tool)', 'POST', '/dev/reset-my-streak', {
          body: {},
          description: 'Clears the demo user streak so the run is repeatable. The wallet ledger is never deleted.',
          tests: [
            status(200),
            "pm.test('Day 1 available', () => { const s = pm.response.json().streak; pm.expect(s.currentDay).to.eql(1); pm.expect(s.claimable).to.eql(true); });",
          ],
        }),
      ],
    },
    {
      name: '2. Claim Day 1 and Day 2 (time travel)',
      item: [
        req('Get streak', 'GET', '/daily-streak', {
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('Day 1 AVAILABLE / TODAY', () => { pm.expect(d.rewards[0].status).to.eql('AVAILABLE'); pm.expect(d.rewards[0].state).to.eql('TODAY'); });",
            "pm.collectionVariables.set('walletBefore', d.wallet.VES);",
          ],
        }),
        req('Claim Day 1 - start (CPA session)', 'POST', '/daily-streak/claim/start', {
          body: {},
          tests: [status(202), "pm.collectionVariables.set('sessionId', pm.response.json().claimSession.id);"],
        }),
        req('Claim Day 1 - confirm', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          pre: WAIT_CPA,
          tests: [status(200), "pm.test('granted +5 VEs', () => pm.expect(pm.response.json().transaction.amount).to.eql(5));"],
        }),
        req('[neg] Claim locked Day 2', 'POST', '/daily-streak/claim/start', { body: {}, tests: [status(409), code('REWARD_LOCKED')] }),
        req('Simulate +24h (dev tool)', 'POST', '/dev/time-travel', {
          body: { hours: 24 },
          tests: [status(200), "pm.test('Day 2 now claimable', () => pm.expect(pm.response.json().streak.claimable).to.eql(true));"],
        }),
        req('Day 2 is TODAY', 'GET', '/daily-streak', {
          tests: [status(200), "pm.test('Day 2 state TODAY', () => pm.expect(pm.response.json().rewards[1].state).to.eql('TODAY'));"],
        }),
        req('[neg] Jump to Day 7', 'POST', '/daily-streak/claim/start', { body: { day: 7 }, tests: [status(403), code('DAY_NOT_ELIGIBLE')] }),
        req('Claim Day 2 - start (with fake reward/user fields)', 'POST', '/daily-streak/claim/start', {
          body: { day: 2, reward: 1000000, amount: 100000, currency: 'INR', streak: 7, userId: 'anotherUser' },
          description: 'All tampering fields are ignored (and audit-logged as TAMPERED_REQUEST); only the backend-configured reward is granted.',
          tests: [status(202), "pm.collectionVariables.set('sessionId', pm.response.json().claimSession.id);"],
        }),
        req('[neg] Other user cannot confirm this session', 'POST', '/daily-streak/claim', {
          auth: '{{token2}}',
          body: { claimSessionId: '{{sessionId}}' },
          pre: WAIT_CPA,
          tests: [status(404), code('CLAIM_SESSION_NOT_FOUND')],
        }),
        req('Claim Day 2 - confirm', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          tests: [
            status(200),
            "pm.test('fake reward ignored: +10 VEs', () => { const t = pm.response.json().transaction; pm.expect(t.amount).to.eql(10); pm.expect(t.currency).to.eql('VES'); });",
            "pm.test('real streak = 2', () => pm.expect(pm.response.json().streak.currentStreak).to.eql(2));",
          ],
        }),
        req('Get history', 'GET', '/daily-streak/history?page=1&limit=10', {
          tests: [status(200), "pm.test('latest claim is Day 2', () => pm.expect(pm.response.json().claims[0].day).to.eql(2));"],
        }),
      ],
    },
    {
      name: '3. Missed day & reset',
      item: [
        req('Simulate +49h (miss Day 3)', 'POST', '/dev/time-travel', {
          body: { hours: 49 },
          tests: [
            status(200),
            "pm.test('streak reset to Day 1', () => { const s = pm.response.json().streak; pm.expect(s.status).to.eql('RESET'); pm.expect(s.currentStreak).to.eql(0); pm.expect(s.currentDay).to.eql(1); });",
          ],
        }),
        req('Get streak after reset', 'GET', '/daily-streak', {
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('reset notice shows missed Day 3', () => pm.expect(d.resetNotice.missedDay).to.eql(3));",
            "pm.test('Day 3 card state MISSED', () => pm.expect(d.rewards[2].state).to.eql('MISSED'));",
            "pm.test('Day 1 is TODAY again', () => pm.expect(d.rewards[0].state).to.eql('TODAY'));",
          ],
        }),
      ],
    },
  ],
};

const collection = {
  info: {
    name: 'VELoop Rewards - Daily Streak API',
    description:
      'Two independent folders:\n\n' +
      '* **Production / Live Flow**: public endpoints only; runs against the deployed API or locally. ' +
      '`newman run <file> --folder "Production / Live Flow" --env-var baseUrl=https://<api>/api`\n' +
      '* **Local QA Only**: needs a local backend with NODE_ENV=development and ENABLE_DEV_TOOLS=true (uses /api/dev/*, which returns 404 in production).\n\n' +
      'Both folders need seeded data (`npm run seed`). Running the whole collection locally executes both.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000/api' },
    { key: 'token', value: '' },
    { key: 'token2', value: '' },
    { key: 'sessionId', value: '' },
    { key: 'walletBefore', value: '' },
    { key: 'liveEmail', value: '' },
  ],
  item: [liveFlow, localQa],
};

fs.writeFileSync(`${__dirname}/VELoop_Daily_Streak.postman_collection.json`, `${JSON.stringify(collection, null, 2)}\n`);
console.log('Postman collection written');
