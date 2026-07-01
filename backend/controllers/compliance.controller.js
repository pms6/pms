'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const service = require('../services/compliance.service');

const create = asyncHandler(async (req, res) => {
  const doc = await service.createCertificate(req.accountId, req.body);
  return created(res, doc, 'Certificate created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listCertificates(req.accountId, req.query);
  return ok(res, items, 'Certificates fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const doc = await service.getCertificateById(req.accountId, req.params.id);
  return ok(res, doc, 'Certificate fetched');
});

const update = asyncHandler(async (req, res) => {
  const doc = await service.updateCertificate(req.accountId, req.params.id, req.body);
  return ok(res, doc, 'Certificate updated');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteCertificate(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
