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

const collection = {
  info: {
    name: 'VELoop Rewards - Daily Streak API',
    description:
      'End-to-end and negative tests for the Daily Streak API. Run the whole collection in order (Collection Runner or newman).\n\n' +
      'Prerequisites: backend running with seeded data (`npm run seed`) and ENABLE_DEV_TOOLS=true. The collection uses the QA-only ' +
      '/api/dev endpoints to reset the demo account and to simulate time passing for that account.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000/api' },
    { key: 'token', value: '' },
    { key: 'token2', value: '' },
    { key: 'sessionId', value: '' },
    { key: 'walletBefore', value: '' },
  ],
  item: [
    {
      name: '1. Auth',
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
        req('[neg] Wrong password', 'POST', '/auth/login', {
          auth: null,
          body: { email: 'demo@veloop.in', password: 'wrong-pass1' },
          tests: [status(401), code('INVALID_CREDENTIALS')],
        }),
      ],
    },
    {
      name: '2. Setup (QA only)',
      item: [
        req('Reset my streak (dev tool)', 'POST', '/dev/reset-my-streak', {
          body: {},
          description: 'Clears the demo user streak so the run is repeatable. Requires ENABLE_DEV_TOOLS=true. The wallet ledger is never deleted.',
          tests: [
            status(200),
            "pm.test('Day 1 available', () => { const s = pm.response.json().streak; pm.expect(s.currentDay).to.eql(1); pm.expect(s.claimable).to.eql(true); });",
          ],
        }),
      ],
    },
    {
      name: '3. Claim flow',
      item: [
        req('Get streak', 'GET', '/daily-streak', {
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('backend provides serverTime', () => pm.expect(d.serverTime).to.be.a('string'));",
            "pm.test('7 reward cards from DB config', () => pm.expect(d.rewards).to.have.length(7));",
            "pm.test('Day 1 AVAILABLE', () => pm.expect(d.rewards[0].status).to.eql('AVAILABLE'));",
            "pm.collectionVariables.set('walletBefore', d.wallet.VES);",
          ],
        }),
        req('Get status', 'GET', '/daily-streak/status', {
          tests: [status(200), "pm.test('current day 1', () => pm.expect(pm.response.json().streak.currentDay).to.eql(1));"],
        }),
        req('Claim Day 1 - start (CPA session)', 'POST', '/daily-streak/claim/start', {
          body: {},
          tests: [
            status(202),
            "const s = pm.response.json().claimSession; pm.test('day 1', () => pm.expect(s.day).to.eql(1)); pm.collectionVariables.set('sessionId', s.id);",
          ],
        }),
        req('[neg] Confirm before CPA finished', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          tests: [status(425), code('CPA_NOT_COMPLETED')],
        }),
        req('Claim Day 1 - confirm', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          pre: WAIT_CPA,
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('granted configured reward', () => { pm.expect(d.transaction.amount).to.eql(5); pm.expect(d.transaction.currency).to.eql('VES'); });",
            "pm.test('ledger balances', () => pm.expect(d.transaction.balanceAfter - d.transaction.balanceBefore).to.eql(5));",
            "pm.test('reference id', () => pm.expect(d.claim.referenceId).to.match(/^STREAK-/));",
          ],
        }),
        req('[neg] Duplicate confirm (idempotent)', 'POST', '/daily-streak/claim', {
          body: { claimSessionId: '{{sessionId}}' },
          tests: [status(200), "pm.test('idempotent replay, no new credit', () => pm.expect(pm.response.json().idempotent).to.eql(true));"],
        }),
        req('Get updated streak', 'GET', '/daily-streak', {
          tests: [
            status(200),
            'const d = pm.response.json();',
            "pm.test('Day 1 CLAIMED', () => pm.expect(d.rewards[0].status).to.eql('CLAIMED'));",
            "pm.test('Day 2 LOCKED with nextClaimAt', () => { pm.expect(d.rewards[1].status).to.eql('LOCKED'); pm.expect(d.streak.nextClaimAt).to.be.a('string'); });",
            "pm.test('wallet credited exactly once', () => pm.expect(d.wallet.VES).to.eql(Number(pm.collectionVariables.get('walletBefore')) + 5));",
          ],
        }),
        req('[neg] Claim locked Day 2', 'POST', '/daily-streak/claim/start', { body: {}, tests: [status(409), code('REWARD_LOCKED')] }),
        req('[neg] Re-claim Day 1', 'POST', '/daily-streak/claim/start', { body: { day: 1 }, tests: [status(409), code('ALREADY_CLAIMED')] }),
        req('Simulate +24h (dev tool)', 'POST', '/dev/time-travel', {
          body: { hours: 24 },
          tests: [status(200), "pm.test('Day 2 now claimable', () => pm.expect(pm.response.json().streak.claimable).to.eql(true));"],
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
      name: '4. Missed day & reset',
      item: [
        req('Simulate +49h (miss Day 3)', 'POST', '/dev/time-travel', {
          body: { hours: 49 },
          tests: [
            status(200),
            "pm.test('streak reset to Day 1', () => { const s = pm.response.json().streak; pm.expect(s.status).to.eql('RESET'); pm.expect(s.currentStreak).to.eql(0); pm.expect(s.currentDay).to.eql(1); });",
          ],
        }),
        req('Get streak after reset', 'GET', '/daily-streak', {
          tests: [status(200), "pm.test('reset notice shows missed Day 3', () => pm.expect(pm.response.json().resetNotice.missedDay).to.eql(3));"],
        }),
      ],
    },
    {
      name: '5. Security / validation',
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
      name: '6. Wallet',
      item: [
        req('Get wallet', 'GET', '/wallet', { tests: [status(200)] }),
        req('Get transactions', 'GET', '/wallet/transactions?page=1&limit=10', {
          tests: [status(200), "pm.test('ledger has streak credits', () => pm.expect(pm.response.json().items.some((t) => t.source === 'DAILY_STREAK')).to.eql(true));"],
        }),
      ],
    },
  ],
};

fs.writeFileSync(`${__dirname}/VELoop_Daily_Streak.postman_collection.json`, `${JSON.stringify(collection, null, 2)}\n`);
console.log('Postman collection written');
