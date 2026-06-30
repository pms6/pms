'use strict';

const mongoose = require('mongoose');

/** Append-only audit trail. Never update or delete entries. */
const auditLogSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String },
    entityType: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    changes: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

auditLogSchema.index({ accountId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
