'use strict';

const mongoose = require('mongoose');

/**
 * Auth infrastructure collection (not part of the 37 domain collections in
 * DATA_MODEL.md) — backs refresh-token rotation with reuse detection.
 *
 * One document per issued refresh token. The plaintext token is never stored;
 * only the SHA-256 hash of its secret. Rotation creates a child session and
 * revokes the parent. All sessions spawned from one login share a `familyId`,
 * so detecting a replay of an already-rotated token lets us revoke the whole
 * family (suspected theft).
 */
const sessionSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Rotation lineage — all descendants of one login share this id.
    familyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    // SHA-256 of the token secret. Never the plaintext.
    tokenHash: { type: String, required: true },

    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: {
      type: String,
      enum: ['logout', 'rotated', 'reuse_detected', 'admin', 'logout_all'],
    },
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },

    // Device / context metadata for the "active sessions" view.
    userAgent: { type: String },
    ip: { type: String },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

// TTL index — MongoDB purges sessions once they pass expiresAt.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// A session is usable iff not revoked and not yet expired.
sessionSchema.methods.isActive = function isActive() {
  return !this.revokedAt && this.expiresAt > new Date();
};

module.exports = mongoose.model('Session', sessionSchema);
