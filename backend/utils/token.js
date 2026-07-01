'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Build the access-token payload from a user document.
 * Shape must match what middleware/auth.js reads: { sub, accountId, role, sid }.
 * `sid` is the originating Session id, so the "active sessions" view can mark
 * which device is the current one.
 *
 * Note: refresh tokens are NOT JWTs — they are opaque, DB-backed, hashed and
 * rotated (see services/session.service.js + utils/refreshToken.js).
 */
function payloadFor(user, sessionId) {
  const payload = {
    sub: user._id.toString(),
    accountId: user.accountId.toString(),
    role: user.role,
  };
  if (sessionId) payload.sid = sessionId.toString();
  return payload;
}

function signAccessToken(user, sessionId) {
  return jwt.sign(payloadFor(user, sessionId), env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
}

module.exports = { signAccessToken };
