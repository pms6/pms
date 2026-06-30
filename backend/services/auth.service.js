'use strict';

const bcrypt = require('bcryptjs');
const { Account, User } = require('../models');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { issueTokens, verifyRefreshToken } = require('../utils/token');

function sanitize(userDoc) {
  const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete obj.passwordHash;
  return obj;
}

/**
 * Public sign-up. Creates a brand-new Account and its first admin User,
 * then returns the user plus a fresh token pair.
 * @param {object} data - { accountName, accountType, name, email, password }
 */
async function register(data) {
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
    role: 'admin', // first user owns the account
    status: 'active',
    lastLogin: new Date(),
  });

  return { account, user: sanitize(user), tokens: issueTokens(user) };
}

/**
 * Email + password login. Returns the user and a fresh token pair.
 */
async function login(email, password) {
  // passwordHash has select:false on the model, so request it explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.passwordHash) throw ApiError.unauthorized('Invalid credentials');

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw ApiError.unauthorized('Invalid credentials');

  if (user.status === 'disabled') throw ApiError.forbidden('Account is disabled');

  user.lastLogin = new Date();
  await user.save();

  return { user: sanitize(user), tokens: issueTokens(user) };
}

/**
 * Exchange a valid refresh token for a new token pair.
 */
async function refresh(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || user.status === 'disabled') throw ApiError.unauthorized('User no longer active');

  return { tokens: issueTokens(user) };
}

module.exports = { register, login, refresh };
