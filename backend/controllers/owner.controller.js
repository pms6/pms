'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const ownerService = require('../services/owner.service');

const create = asyncHandler(async (req, res) => {
  const owner = await ownerService.createOwner(req.accountId, req.body);
  return created(res, owner, 'Owner created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await ownerService.listOwners(req.accountId, req.query);
  return ok(res, items, 'Owners fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const owner = await ownerService.getOwnerById(req.accountId, req.params.id);
  return ok(res, owner, 'Owner fetched');
});

const update = asyncHandler(async (req, res) => {
  const owner = await ownerService.updateOwner(req.accountId, req.params.id, req.body);
  return ok(res, owner, 'Owner updated');
});

const remove = asyncHandler(async (req, res) => {
  await ownerService.deleteOwner(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
