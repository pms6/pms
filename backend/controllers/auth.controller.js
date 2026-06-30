'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/ApiResponse');
const { getUserById } = require('../services/user.service');
const authService = require('../services/auth.service');

/** POST /auth/register */
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return created(res, result, 'Account registered');
});

/** POST /auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  return ok(res, result, 'Logged in');
});

/** POST /auth/refresh */
const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  return ok(res, result, 'Token refreshed');
});

/** GET /auth/me — the authenticated user's own profile */
const me = asyncHandler(async (req, res) => {
  const user = await getUserById(req.accountId, req.user.id);
  return ok(res, user, 'Current user');
});

module.exports = { register, login, refresh, me };
