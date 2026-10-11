const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const streakService = require('./streak.service');
const { audit } = require('./audit.service');

const BCRYPT_ROUNDS = 12;
const JWT_ALGORITHM = 'HS256';

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

async function register({ name, email, password }, ctx = {}) {
  const existing = await User.exists({ email });
  if (existing) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');

  let user;
  try {
    user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    throw error;
  }
  await streakService.initializeUser(user._id);
  await audit('USER_REGISTERED', { userId: user._id, req: ctx.req });
  return { user: user.toPublicJSON(), token: signToken(user) };
}

async function login({ email, password }, ctx = {}) {
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same response for unknown email and wrong password (no account enumeration).
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    await audit('USER_LOGIN_FAILED', { userId: user ? user._id : null, req: ctx.req, metadata: { email } });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');

  user.lastLoginAt = new Date();
  // audit() never rejects (it swallows its own errors), so this is safe to run alongside the
  // save rather than after it - saving one round trip on every login.
  await Promise.all([user.save(), audit('USER_LOGIN', { userId: user._id, req: ctx.req })]);
  return { user: user.toPublicJSON(), token: signToken(user) };
}

module.exports = { register, login, signToken, verifyToken };
