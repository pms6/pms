'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Verify the JWT access token and attach the decoded principal to req.user.
 * Expected payload: { sub: userId, accountId, role }.
 */
function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    req.user = {
      id: payload.sub,
      accountId: payload.accountId,
      role: payload.role,
    };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

module.exports = { authenticate };
