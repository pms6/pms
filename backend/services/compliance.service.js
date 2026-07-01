'use strict';

const { ComplianceCertificate, Property } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

const EXPIRING_WINDOW_DAYS = 30;

/** Resolve the set of property ids owned by this account. */
async function accountPropertyIds(accountId) {
  const props = await Property.find({ accountId, isDeleted: { $ne: true } }).select('_id').lean();
  return props.map((p) => p._id);
}

/** Confirm a property belongs to the account (for writes). */
async function assertProperty(accountId, propertyId) {
  const exists = await Property.exists({ _id: propertyId, accountId, isDeleted: { $ne: true } });
  if (!exists) throw ApiError.badRequest('Property not found in this account');
}

/** Derive valid | expiring | expired from the expiry date. */
function deriveStatus(expiryDate) {
  if (!expiryDate) return 'valid';
  const now = Date.now();
  const exp = new Date(expiryDate).getTime();
  if (exp < now) return 'expired';
  if (exp <= now + EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000) return 'expiring';
  return 'valid';
}

function decorate(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.status = deriveStatus(obj.expiryDate);
  return obj;
}

async function createCertificate(accountId, data) {
  await assertProperty(accountId, data.propertyId);
  const doc = await ComplianceCertificate.create({ ...data, status: deriveStatus(data.expiryDate) });
  return decorate(doc);
}

async function listCertificates(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const propertyIds = await accountPropertyIds(accountId);

  const filter = { propertyId: { $in: propertyIds } };
  if (query.propertyId) filter.propertyId = query.propertyId;
  if (query.certType) filter.certType = query.certType;

  const now = new Date();
  if (query.due === 'soon') {
    filter.expiryDate = { $gte: now, $lte: new Date(now.getTime() + EXPIRING_WINDOW_DAYS * 86400000) };
  } else if (query.due === 'expired') {
    filter.expiryDate = { $lt: now };
  }

  const [items, total] = await Promise.all([
    ComplianceCertificate.find(filter)
      .populate('propertyId', 'name')
      .sort(sort || 'expiryDate')
      .skip(skip)
      .limit(limit),
    ComplianceCertificate.countDocuments(filter),
  ]);

  let decorated = items.map(decorate);
  if (query.status) decorated = decorated.filter((c) => c.status === query.status);

  return { items: decorated, meta: buildMeta({ page, limit }, total) };
}

/** Ensure a certificate's property belongs to the account, then return it. */
async function findScoped(accountId, id) {
  const propertyIds = await accountPropertyIds(accountId);
  const doc = await ComplianceCertificate.findOne({
    _id: id,
    propertyId: { $in: propertyIds },
  }).populate('propertyId', 'name');
  if (!doc) throw ApiError.notFound('Certificate not found');
  return doc;
}

async function getCertificateById(accountId, id) {
  return decorate(await findScoped(accountId, id));
}

async function updateCertificate(accountId, id, data) {
  const existing = await findScoped(accountId, id);
  Object.assign(existing, data);
  if (data.expiryDate !== undefined) existing.status = deriveStatus(data.expiryDate);
  await existing.save();
  return decorate(existing);
}

async function deleteCertificate(accountId, id) {
  const doc = await findScoped(accountId, id);
  await doc.deleteOne();
  return decorate(doc);
}

/** Counts for the dashboard: due-soon (expiring) and expired. */
async function counts(accountId, propertyIds) {
  const ids = propertyIds || (await accountPropertyIds(accountId));
  const now = new Date();
  const [expiring, expired] = await Promise.all([
    ComplianceCertificate.countDocuments({
      propertyId: { $in: ids },
      expiryDate: { $gte: now, $lte: new Date(now.getTime() + EXPIRING_WINDOW_DAYS * 86400000) },
    }),
    ComplianceCertificate.countDocuments({ propertyId: { $in: ids }, expiryDate: { $lt: now } }),
  ]);
  return { expiring, expired };
}

module.exports = {
  createCertificate,
  listCertificates,
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  counts,
  deriveStatus,
};
