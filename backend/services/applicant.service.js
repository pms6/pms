'use strict';

const { Applicant } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

/** Serialize, converting Decimal128 holdingDeposit to a string. */
function sanitize(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.holdingDeposit = obj.holdingDeposit != null ? obj.holdingDeposit.toString() : null;
  return obj;
}

async function createApplicant(accountId, data) {
  const doc = await Applicant.create({ accountId, ...data });
  return sanitize(doc);
}

async function listApplicants(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);

  const filter = { accountId };
  if (query.referenceStatus) filter.referenceStatus = query.referenceStatus;
  if (query.onboardingStatus) filter.onboardingStatus = query.onboardingStatus;

  const [items, total] = await Promise.all([
    Applicant.find(filter).populate('leadId', 'name email').sort(sort).skip(skip).limit(limit),
    Applicant.countDocuments(filter),
  ]);
  return { items: items.map(sanitize), meta: buildMeta({ page, limit }, total) };
}

async function getApplicantById(accountId, id) {
  const doc = await Applicant.findOne({ _id: id, accountId }).populate('leadId', 'name email');
  if (!doc) throw ApiError.notFound('Applicant not found');
  return sanitize(doc);
}

async function updateApplicant(accountId, id, data) {
  const doc = await Applicant.findOneAndUpdate(
    { _id: id, accountId },
    { $set: data },
    { new: true, runValidators: true }
  ).populate('leadId', 'name email');
  if (!doc) throw ApiError.notFound('Applicant not found');
  return sanitize(doc);
}

async function deleteApplicant(accountId, id) {
  const doc = await Applicant.findOneAndDelete({ _id: id, accountId });
  if (!doc) throw ApiError.notFound('Applicant not found');
  return sanitize(doc);
}

module.exports = {
  createApplicant,
  listApplicants,
  getApplicantById,
  updateApplicant,
  deleteApplicant,
};
