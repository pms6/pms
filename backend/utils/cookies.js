'use strict';

const { parse } = require('cookie');
const env = require('../config/env');

/**
 * Refresh-token cookie helpers.
 *
 * The refresh token lives in an httpOnly cookie so client-side JS can never
 * read it (mitigates XSS token theft). It is scoped to the auth path so it is
 * only ever sent to /auth/refresh and /auth/logout — not on every API call.
 *
 * Dev (same-site localhost over http): SameSite=Lax, not Secure.
 * Prod (SPA and API on different domains, e.g. Vercel + Railway): the request
 * is cross-site, so the cookie must be SameSite=None; Secure to be sent at all.
 */
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_PATH = `${env.apiPrefix}/auth`;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches refresh JWT expiry

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: REFRESH_PATH,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}

/** Read the refresh token from the request cookies (undefined if absent). */
function readRefreshCookie(req) {
  const cookies = parse(req.headers.cookie || '');
  return cookies[REFRESH_COOKIE];
}

module.exports = { setRefreshCookie, clearRefreshCookie, readRefreshCookie, REFRESH_COOKIE };
