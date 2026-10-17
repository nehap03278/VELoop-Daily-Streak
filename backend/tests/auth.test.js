const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { request, createApp, setupDatabase, teardownDatabase, createUser, auth } = require('./helpers');
const { User } = require('../src/models');
const { BCRYPT_ROUNDS } = require('../src/services/auth.service');

let app;
beforeAll(async () => {
  await setupDatabase('auth');
  app = createApp();
});
afterAll(teardownDatabase);

describe('Authentication', () => {
  test('register returns a JWT and creates streak + wallet', async () => {
    const { token, user } = await createUser(app);
    expect(token).toEqual(expect.any(String));
    expect(user).not.toHaveProperty('passwordHash');
    const wallet = await request(app).get('/api/wallet').set(auth(token)).expect(200);
    expect(wallet.body.wallet.balances).toEqual({ VES: 0, INR: 0 });
  });

  test('duplicate email is rejected', async () => {
    const { credentials } = await createUser(app);
    const res = await request(app).post('/api/auth/register').send(credentials).expect(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  test('login works and wrong password gives a generic error', async () => {
    const { credentials } = await createUser(app);
    await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password }).expect(200);
    const bad = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'nope-nope1' }).expect(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope1' }).expect(401);
    expect(bad.body.error).toEqual(unknown.body.error);
  });

  test('weak passwords and bad emails fail validation', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'not-an-email', password: 'short' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test.each([
    ['GET', '/api/daily-streak'],
    ['GET', '/api/daily-streak/status'],
    ['GET', '/api/daily-streak/history'],
    ['POST', '/api/daily-streak/claim/start'],
    ['POST', '/api/daily-streak/claim'],
    ['GET', '/api/wallet'],
    ['GET', '/api/wallet/transactions'],
  ])('%s %s requires authentication', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path).expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('forged, expired, alg=none and malformed tokens are rejected', async () => {
    const { user } = await createUser(app);
    const forged = jwt.sign({ sub: user.id }, 'some-other-secret');
    const expired = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id })).toString('base64url')}.`;
    const badSub = jwt.sign({ sub: 'not-an-object-id' }, process.env.JWT_SECRET);
    for (const token of [forged, expired, none, badSub, 'garbage']) {
      const res = await request(app).get('/api/daily-streak').set(auth(token)).expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('GET /auth/me returns the token owner', async () => {
    const { token, user } = await createUser(app);
    const res = await request(app).get('/api/auth/me').set(auth(token)).expect(200);
    expect(res.body.user.id).toBe(user.id);
  });

  test('a password hashed at an older cost still logs in and is upgraded to the current cost', async () => {
    const { credentials, user } = await createUser(app);
    await User.updateOne({ _id: user.id }, { $set: { passwordHash: await bcrypt.hash(credentials.password, 12) } });

    await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password }).expect(200);

    const stored = await User.findById(user.id).select('+passwordHash');
    expect(bcrypt.getRounds(stored.passwordHash)).toBe(BCRYPT_ROUNDS);
    expect(await bcrypt.compare(credentials.password, stored.passwordHash)).toBe(true);
    await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password }).expect(200);
  });
});
