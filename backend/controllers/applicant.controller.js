'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const service = require('../services/applicant.service');

const create = asyncHandler(async (req, res) => {
  const doc = await service.createApplicant(req.accountId, req.body);
  return created(res, doc, 'Applicant created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listApplicants(req.accountId, req.query);
  return ok(res, items, 'Applicants fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const doc = await service.getApplicantById(req.accountId, req.params.id);
  return ok(res, doc, 'Applicant fetched');
});

const update = asyncHandler(async (req, res) => {
  const doc = await service.updateApplicant(req.accountId, req.params.id, req.body);
  return ok(res, doc, 'Applicant updated');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteApplicant(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
