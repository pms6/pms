'use strict';

const bcrypt = require('bcryptjs');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { parsePagination, buildMeta } = require('../utils/pagination');

/* Strip sensitive fields before returning a user to the client. */
function sanitize(userDoc) {
  if (!userDoc) return userDoc;
  const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete obj.passwordHash;
  return obj;
}

/**
 * Create a user within the caller's account.
 * @param {string} accountId - tenant from the JWT
 * @param {object} data - { name, email, password, role, status }
 */
async function createUser(accountId, data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const passwordHash = await bcrypt.hash(data.password, env.bcryptSaltRounds);

  const user = await User.create({
    accountId,
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
    status: data.status,
  });

  return sanitize(user);
}

/**
 * List users for an account, paginated and optionally filtered.
 * @param {string} accountId
 * @param {object} query - { page, limit, sort, role, status, search }
 */
async function listUsers(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);

  const filter = { accountId };
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return { items: items.map(sanitize), meta: buildMeta({ page, limit }, total) };
}

/** Get a single user scoped to the account. */
async function getUserById(accountId, id) {
  const user = await User.findOne({ _id: id, accountId });
  if (!user) throw ApiError.notFound('User not found');
  return sanitize(user);
}

/**
 * Update a user's mutable fields. Re-hashes password if supplied.
 */
async function updateUser(accountId, id, data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.role !== undefined) update.role = data.role;
  if (data.status !== undefined) update.status = data.status;

  if (data.email !== undefined) {
    const clash = await User.findOne({ email: data.email, _id: { $ne: id } });
    if (clash) throw ApiError.conflict('A user with this email already exists');
    update.email = data.email;
  }

  if (data.password) {
    update.passwordHash = await bcrypt.hash(data.password, env.bcryptSaltRounds);
  }

  const user = await User.findOneAndUpdate(
    { _id: id, accountId },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!user) throw ApiError.notFound('User not found');
  return sanitize(user);
}

/** Hard-delete a user scoped to the account. */
async function deleteUser(accountId, id) {
  const user = await User.findOneAndDelete({ _id: id, accountId });
  if (!user) throw ApiError.notFound('User not found');
  return sanitize(user);
}

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
};
