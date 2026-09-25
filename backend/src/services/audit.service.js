const { AuditLog } = require('../models');

/**
 * Records a security/business event. Audit logging must never break the request it describes,
 * so failures are reported to stderr and swallowed.
 */
async function audit(event, { userId = null, req = null, metadata = {} } = {}) {
  try {
    await AuditLog.create({
      event,
      userId,
      ip: req ? req.ip : null,
      userAgent: req ? String(req.get('user-agent') || '').slice(0, 300) : null,
      metadata,
    });
  } catch (error) {
    console.error(`[audit] failed to record ${event}:`, error.message);
  }
}

module.exports = { audit };
