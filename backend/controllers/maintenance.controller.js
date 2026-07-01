'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const service = require('../services/maintenance.service');

const create = asyncHandler(async (req, res) => {
  const doc = await service.createRequest(req.accountId, req.user.id, req.body);
  return created(res, doc, 'Maintenance request created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listRequests(req.accountId, req.query);
  return ok(res, items, 'Maintenance requests fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const doc = await service.getRequestById(req.accountId, req.params.id);
  return ok(res, doc, 'Maintenance request fetched');
});

const update = asyncHandler(async (req, res) => {
  const doc = await service.updateRequest(req.accountId, req.params.id, req.body);
  return ok(res, doc, 'Maintenance request updated');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteRequest(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
