'use strict';

const mongoose = require('mongoose');
const { Session, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { generateSecret, hashSecret, buildToken, parseToken, safeEqual } = require('../utils/refreshToken');

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — keep aligned with the cookie maxAge

function expiry() {
  return new Date(Date.now() + REFRESH_TTL_MS);
}

/**
 * Issue a brand-new session (a new rotation family) and return the plaintext
 * refresh token. Called on login / register.
 */
async function createSession({ accountId, userId, userAgent, ip }) {
  const secret = generateSecret();
  const session = await Session.create({
    accountId,
    userId,
    familyId: new mongoose.Types.ObjectId(), // new family root
    tokenHash: hashSecret(secret),
    expiresAt: expiry(),
    userAgent,
    ip,
    lastUsedAt: new Date(),
  });
  return { session, token: buildToken(session._id, secret) };
}

/** Revoke every still-active session in a family (used on logout-all / breach). */
async function revokeFamily(familyId, reason) {
  await Session.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
}

/**
 * Validate a presented refresh token and rotate it: revoke the old session,
 * issue a child in the same family, and return a fresh token + the user.
 *
 * Reuse detection: if the presented token maps to an ALREADY-revoked session,
 * someone is replaying a rotated token — revoke the whole family and reject.
 */
async function rotate(presentedToken, { userAgent, ip } = {}) {
  const parsed = parseToken(presentedToken);
  if (!parsed || !mongoose.isValidObjectId(parsed.sessionId)) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const session = await Session.findById(parsed.sessionId);
  if (!session) throw ApiError.unauthorized('Invalid refresh token');

  // Replay of a token that was already used/rotated/revoked → treat as theft.
  if (session.revokedAt) {
    await revokeFamily(session.familyId, 'reuse_detected');
    throw ApiError.unauthorized('Refresh token reuse detected; sessions revoked');
  }

  if (!safeEqual(hashSecret(parsed.secret), session.tokenHash)) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  if (session.expiresAt <= new Date()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  const user = await User.findById(session.userId);
  if (!user || user.status === 'disabled') {
    await revokeFamily(session.familyId, 'admin');
    throw ApiError.unauthorized('User no longer active');
  }

  // Rotate: mint the child first, then revoke the parent pointing at it.
  const secret = generateSecret();
  const child = await Session.create({
    accountId: session.accountId,
    userId: session.userId,
    familyId: session.familyId,
    tokenHash: hashSecret(secret),
    expiresAt: expiry(),
    userAgent: userAgent || session.userAgent,
    ip: ip || session.ip,
    lastUsedAt: new Date(),
  });

  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  session.replacedBy = child._id;
  await session.save();

  return { user, session: child, token: buildToken(child._id, secret) };
}

/** Revoke a single session by its token (logout). Forgiving — never throws. */
async function revokeByToken(presentedToken, reason = 'logout') {
  const parsed = parseToken(presentedToken);
  if (!parsed || !mongoose.isValidObjectId(parsed.sessionId)) return false;

  const session = await Session.findById(parsed.sessionId);
  if (!session || session.revokedAt) return false;

  // Only revoke if the secret actually matches — don't let a bogus token id
  // knock out someone else's session.
  if (!safeEqual(hashSecret(parsed.secret), session.tokenHash)) return false;

  session.revokedAt = new Date();
  session.revokedReason = reason;
  await session.save();
  return true;
}

/** List a user's active sessions for the "devices" view. */
async function listForUser(userId, currentSessionId) {
  const sessions = await Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort('-lastUsedAt')
    .lean();

  return sessions.map((s) => ({
    id: s._id,
    userAgent: s.userAgent || null,
    ip: s.ip || null,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    current: currentSessionId ? String(s._id) === String(currentSessionId) : false,
  }));
}

/** Revoke one of the user's own sessions by id. */
async function revokeById(userId, sessionId, reason = 'admin') {
  if (!mongoose.isValidObjectId(sessionId)) throw ApiError.notFound('Session not found');
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
    { new: true }
  );
  if (!session) throw ApiError.notFound('Session not found');
  return true;
}

/** Revoke all of a user's sessions, optionally keeping the current one. */
async function revokeAllForUser(userId, { exceptSessionId } = {}) {
  const filter = { userId, revokedAt: null };
  if (exceptSessionId && mongoose.isValidObjectId(exceptSessionId)) {
    filter._id = { $ne: exceptSessionId };
  }
  const res = await Session.updateMany(filter, {
    $set: { revokedAt: new Date(), revokedReason: 'logout_all' },
  });
  return res.modifiedCount || 0;
}

module.exports = {
  REFRESH_TTL_MS,
  createSession,
  rotate,
  revokeByToken,
  revokeFamily,
  listForUser,
  revokeById,
  revokeAllForUser,
};
