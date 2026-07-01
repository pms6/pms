'use strict';

const { Account, Subscription } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Fetch the caller's account together with its subscription. A subscription
 * row is lazily created on first read so the dashboard/settings always have
 * a plan to display (defaults: free / trial).
 * @param {string} accountId - tenant from the JWT
 */
async function getAccount(accountId) {
  const account = await Account.findById(accountId);
  if (!account) throw ApiError.notFound('Account not found');

  let subscription = await Subscription.findOne({ accountId });
  if (!subscription) {
    subscription = await Subscription.create({ accountId, plan: 'free', status: 'trial' });
  }

  return { account, subscription };
}

/**
 * Update mutable fields on the caller's own account.
 * @param {string} accountId
 * @param {object} data - { name, type, contactEmail, settings }
 */
async function updateAccount(accountId, data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.type !== undefined) update.type = data.type;
  if (data.contactEmail !== undefined) update.contactEmail = data.contactEmail;
  if (data.settings !== undefined) update.settings = data.settings;

  const account = await Account.findByIdAndUpdate(
    accountId,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!account) throw ApiError.notFound('Account not found');

  const subscription = await Subscription.findOne({ accountId });
  return { account, subscription };
}

module.exports = { getAccount, updateAccount };
