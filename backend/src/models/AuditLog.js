const mongoose = require('mongoose');

const EVENTS = [
  'USER_REGISTERED',
  'USER_LOGIN',
  'USER_LOGIN_FAILED',
  'STREAK_CLAIM_REQUEST',
  'STREAK_CLAIM_SUCCESS',
  'STREAK_CLAIM_REJECTED',
  'STREAK_RESET',
  'STREAK_CYCLE_COMPLETED',
  'DUPLICATE_CLAIM',
  'INVALID_CLAIM',
  'TAMPERED_REQUEST',
  'DEV_TIME_TRAVEL',
  'DEV_STREAK_RESET',
];

const auditLogSchema = new mongoose.Schema(
  {
    event: { type: String, enum: EVENTS, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.EVENTS = EVENTS;
