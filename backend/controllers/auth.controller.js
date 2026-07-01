'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { getUserById } = require('../services/user.service');
const authService = require('../services/auth.service');
const sessionService = require('../services/session.service');
const { setRefreshCookie, clearRefreshCookie, readRefreshCookie } = require('../utils/cookies');

/** Pull device/context metadata off the request for session records. */
function ctxOf(req) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/** POST /auth/register */
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, ctxOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return created(res, result, 'Account registered');
});

/** POST /auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, ctxOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return ok(res, result, 'Logged in');
});

/**
 * POST /auth/refresh
 * Prefers the httpOnly cookie (web clients); falls back to a body token for
 * API/mobile clients. Rotates the session and the cookie.
 */
const refresh = asyncHandler(async (req, res) => {
  const token = readRefreshCookie(req) || req.body.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token provided');

  const result = await authService.refresh(token, ctxOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return ok(res, result, 'Token refreshed');
});

/** POST /auth/logout — revokes the current session and clears the cookie. */
const logout = asyncHandler(async (req, res) => {
  const token = readRefreshCookie(req) || req.body.refreshToken;
  if (token) await sessionService.revokeByToken(token, 'logout');
  clearRefreshCookie(res);
  return ok(res, null, 'Logged out');
});

/** GET /auth/me — the authenticated user's own profile */
const me = asyncHandler(async (req, res) => {
  const user = await getUserById(req.accountId, req.user.id);
  return ok(res, user, 'Current user');
});

/** GET /auth/sessions — the caller's active sessions (devices) */
const listSessions = asyncHandler(async (req, res) => {
  const sessions = await sessionService.listForUser(req.user.id, req.user.sid);
  return ok(res, sessions, 'Active sessions');
});

/** DELETE /auth/sessions/:id — revoke one of the caller's own sessions */
const revokeSession = asyncHandler(async (req, res) => {
  await sessionService.revokeById(req.user.id, req.params.id, 'admin');
  return noContent(res);
});

/**
 * POST /auth/logout-all — revoke every session for the caller except the
 * current one, so the active device stays signed in.
 */
const logoutAll = asyncHandler(async (req, res) => {
  const revoked = await sessionService.revokeAllForUser(req.user.id, {
    exceptSessionId: req.user.sid,
  });
  return ok(res, { revoked }, 'Other sessions revoked');
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  listSessions,
  revokeSession,
  logoutAll,
};
