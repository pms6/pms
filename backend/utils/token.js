'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Build the JWT payload from a user document.
 * Shape must match what middleware/auth.js reads: { sub, accountId, role }.
 */
function payloadFor(user) {
  return {
    sub: user._id.toString(),
    accountId: user.accountId.toString(),
    role: user.role,
  };
}

function signAccessToken(user) {
  return jwt.sign(payloadFor(user), env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
}

function signRefreshToken(user) {
  return jwt.sign(payloadFor(user), env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

/** Issue both tokens for a user. */
function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

module.exports = { signAccessToken, signRefreshToken, verifyRefreshToken, issueTokens };
