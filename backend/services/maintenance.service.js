'use strict';

const { MaintenanceRequest, Property } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

/** Verify a referenced property belongs to the account (when supplied). */
async function assertProperty(accountId, propertyId) {
  if (!propertyId) return;
  const exists = await Property.exists({ _id: propertyId, accountId, isDeleted: { $ne: true } });
  if (!exists) throw ApiError.badRequest('Property not found in this account');
}

/** Serialize, converting Decimal128 cost to a string. */
function sanitize(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.cost = obj.cost != null ? obj.cost.toString() : null;
  return obj;
}

async function createRequest(accountId, reportedBy, data) {
  await assertProperty(accountId, data.propertyId);
  const doc = await MaintenanceRequest.create({ accountId, reportedBy, ...data });
  return sanitize(doc);
}

async function listRequests(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);

  const filter = { accountId };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.propertyId) filter.propertyId = query.propertyId;

  const [items, total] = await Promise.all([
    MaintenanceRequest.find(filter)
      .populate('propertyId', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    MaintenanceRequest.countDocuments(filter),
  ]);
  return { items: items.map(sanitize), meta: buildMeta({ page, limit }, total) };
}

async function getRequestById(accountId, id) {
  const doc = await MaintenanceRequest.findOne({ _id: id, accountId }).populate('propertyId', 'name');
  if (!doc) throw ApiError.notFound('Maintenance request not found');
  return sanitize(doc);
}

async function updateRequest(accountId, id, data) {
  if (data.propertyId) await assertProperty(accountId, data.propertyId);
  const doc = await MaintenanceRequest.findOneAndUpdate(
    { _id: id, accountId },
    { $set: data },
    { new: true, runValidators: true }
  ).populate('propertyId', 'name');
  if (!doc) throw ApiError.notFound('Maintenance request not found');
  return sanitize(doc);
}

async function deleteRequest(accountId, id) {
  const doc = await MaintenanceRequest.findOneAndDelete({ _id: id, accountId });
  if (!doc) throw ApiError.notFound('Maintenance request not found');
  return sanitize(doc);
}

module.exports = {
  createRequest,
  listRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
};
