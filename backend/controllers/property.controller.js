'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const propertyService = require('../services/property.service');

const create = asyncHandler(async (req, res) => {
  const property = await propertyService.createProperty(req.accountId, req.body);
  return created(res, property, 'Property created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await propertyService.listProperties(req.accountId, req.query);
  return ok(res, items, 'Properties fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const property = await propertyService.getPropertyById(req.accountId, req.params.id);
  return ok(res, property, 'Property fetched');
});

const update = asyncHandler(async (req, res) => {
  const property = await propertyService.updateProperty(req.accountId, req.params.id, req.body);
  return ok(res, property, 'Property updated');
});

const remove = asyncHandler(async (req, res) => {
  await propertyService.deleteProperty(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
