'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Multi-tenancy guard. Exposes req.accountId (from the JWT) so every
 * tenant-scoped query can filter by it. This is the single enforcement
 * point for the "every query MUST filter by accountId" rule.
 *
 * Helper usage in a service:
 *   Model.find({ accountId: req.accountId, ...filters })
 */
function accountScope(req, _res, next) {
  if (!req.user || !req.user.accountId) {
    return next(ApiError.unauthorized('No account context on request'));
  }
  req.accountId = req.user.accountId;
  return next();
}

module.exports = { accountScope };
