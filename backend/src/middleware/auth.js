const mongoose = require('mongoose');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const { verifyToken } = require('../services/auth.service');

/**
 * Identity comes exclusively from the verified JWT. Any userId in the body/query is ignored by design.
 */
async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.'));
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'Your session has expired. Please log in again.'));
  }

  if (!payload || typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.'));
  }

  const user = await User.findById(payload.sub);
  if (!user) return next(new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.'));
  if (user.status !== 'ACTIVE') return next(new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.'));

  req.user = user;
  return next();
}

module.exports = { requireAuth };
