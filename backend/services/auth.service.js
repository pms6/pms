'use strict';

const bcrypt = require('bcryptjs');
const { Account, User } = require('../models');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { signAccessToken } = require('../utils/token');
const sessionService = require('./session.service');

function sanitize(userDoc) {
  const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete obj.passwordHash;
  return obj;
}

/** Issue an access token + a fresh rotating refresh-token session for a user. */
async function issueFor(user, ctx = {}) {
  const { session, token: refreshToken } = await sessionService.createSession({
    accountId: user.accountId,
    userId: user._id,
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });
  return { accessToken: signAccessToken(user, session._id), refreshToken };
}

/**
 * Public sign-up. Creates a brand-new Account and its first user (the
 * account-owning admin unless a role is supplied), then returns the user plus
 * a fresh token pair.
 * @param {object} data - { accountName, accountType, name, email, password, role }
 * @param {object} ctx  - { userAgent, ip }
 */
async function register(data, ctx) {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const account = await Account.create({
    name: data.accountName,
    type: data.accountType || 'landlord',
    contactEmail: data.email,
  });

  const passwordHash = await bcrypt.hash(data.password, env.bcryptSaltRounds);

  const user = await User.create({
    accountId: account._id,
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role || 'admin', // first user owns the account; defaults to admin
    status: 'active',
    lastLogin: new Date(),
  });

  return { account, user: sanitize(user), tokens: await issueFor(user, ctx) };
}

/**
 * Email + password login. Returns the user and a fresh token pair.
 * @param {object} ctx - { userAgent, ip }
 */
async function login(email, password, ctx) {
  // passwordHash has select:false on the model, so request it explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.passwordHash) throw ApiError.unauthorized('Invalid credentials');

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw ApiError.unauthorized('Invalid credentials');

  if (user.status === 'disabled') throw ApiError.forbidden('Account is disabled');

  user.lastLogin = new Date();
  await user.save();

  return { user: sanitize(user), tokens: await issueFor(user, ctx) };
}

/**
 * Rotate a refresh token: validates + rotates the session (with reuse
 * detection) and mints a new access token. Returns a fresh token pair.
 * @param {string} refreshToken - opaque token from cookie or body
 * @param {object} ctx - { userAgent, ip }
 */
async function refresh(refreshToken, ctx) {
  const { user, session, token } = await sessionService.rotate(refreshToken, ctx);
  return {
    tokens: {
      accessToken: signAccessToken(user, session._id),
      refreshToken: token,
    },
  };
}

module.exports = { register, login, refresh };
