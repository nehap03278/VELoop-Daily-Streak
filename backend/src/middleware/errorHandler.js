const AppError = require('../utils/AppError');
const clock = require('../utils/clock');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'));
}

/**
 * Converts every error into a safe JSON envelope. Internal errors (MongoServerError, CastError, ...) are
 * logged server-side but never exposed to the client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Unable to process your request. Please try again.';
  let details;

  if (error instanceof AppError) {
    ({ status, code, message, details } = error);
  } else if (error && error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body is not valid JSON.';
  } else if (error && error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request body is too large.';
  } else {
    console.error('[error]', req.method, req.originalUrl, error);
  }

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    serverTime: clock.now(),
  });
}

module.exports = { notFound, errorHandler };


























































































