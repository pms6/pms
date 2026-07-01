'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const service = require('../services/lead.service');

const create = asyncHandler(async (req, res) => {
  const lead = await service.createLead(req.accountId, req.user.id, req.body);
  return created(res, lead, 'Lead created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listLeads(req.accountId, req.query);
  return ok(res, items, 'Leads fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const lead = await service.getLeadById(req.accountId, req.params.id);
  return ok(res, lead, 'Lead fetched');
});

const update = asyncHandler(async (req, res) => {
  const lead = await service.updateLead(req.accountId, req.params.id, req.body);
  return ok(res, lead, 'Lead updated');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteLead(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
