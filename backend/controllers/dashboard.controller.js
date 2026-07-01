'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/ApiResponse');
const dashboardService = require('../services/dashboard.service');

/** GET /dashboard/stats — headline statistics for the caller's account */
const stats = asyncHandler(async (req, res) => {
  const data = await dashboardService.getStats(req.accountId);
  return ok(res, data, 'Dashboard stats');
});

module.exports = { stats };
