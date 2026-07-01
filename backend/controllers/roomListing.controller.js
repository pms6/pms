'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const service = require('../services/roomListing.service');

const create = asyncHandler(async (req, res) => {
  const doc = await service.createListing(req.accountId, req.body);
  return created(res, doc, 'Listing created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listListings(req.accountId, req.query);
  return ok(res, items, 'Listings fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const doc = await service.getListingById(req.accountId, req.params.id);
  return ok(res, doc, 'Listing fetched');
});

const update = asyncHandler(async (req, res) => {
  const doc = await service.updateListing(req.accountId, req.params.id, req.body);
  return ok(res, doc, 'Listing updated');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteListing(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
