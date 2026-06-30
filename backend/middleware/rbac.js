'use strict';

const ApiError = require('../utils/ApiError');

/** Valid roles, mirrors User.role enum in the data model. */
const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  FINANCE: 'finance',
  TENANT: 'tenant',
});

/**
 * Restrict a route to one or more roles. Use after authenticate.
 *   router.post('/', authenticate, requireRole(ROLES.ADMIN, ROLES.MANAGER), handler)
 */
function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient role for this action'));
    }
    return next();
  };
}

module.exports = { requireRole, ROLES };
