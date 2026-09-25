const AppError = require('../utils/AppError');

/**
 * Validates req[source] with a zod schema. Unknown keys are stripped, so only whitelisted,
 * well-typed values ever reach a controller.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source] ?? {});
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
      return next(new AppError(400, 'VALIDATION_ERROR', details[0] ? details[0].message : 'Invalid request.', details));
    }
    req.validated = { ...(req.validated || {}), [source]: parsed.data };
    return next();
  };
}

module.exports = { validate };
