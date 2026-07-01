'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/ApiResponse');
const accountService = require('../services/account.service');

/** GET /accounts/me — the caller's account + subscription */
const getMine = asyncHandler(async (req, res) => {
  const result = await accountService.getAccount(req.accountId);
  return ok(res, result, 'Account fetched');
});

/** PATCH /accounts/me — update the caller's account (admin only) */
const updateMine = asyncHandler(async (req, res) => {
  const result = await accountService.updateAccount(req.accountId, req.body);
  return ok(res, result, 'Account updated');
});

module.exports = { getMine, updateMine };
