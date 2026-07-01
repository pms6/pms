'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const service = require('../services/viewing.service');

const create = asyncHandler(async (req, res) => {
  const viewing = await service.createViewing(req.accountId, req.user.id, req.body);
  return created(res, viewing, 'Viewing scheduled');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listViewings(req.accountId, req.query);
  return ok(res, items, 'Viewings fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const viewing = await service.getViewingById(req.accountId, req.params.id);
  return ok(res, viewing, 'Viewing fetched');
});

const update = asyncHandler(async (req, res) => {
  const viewing = await service.updateViewing(req.accountId, req.params.id, req.body);
  return ok(res, viewing, 'Viewing updated');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteViewing(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
