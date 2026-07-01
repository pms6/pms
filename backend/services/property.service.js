'use strict';

const { Property, Owner, Room } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

/** Ensure the referenced owner exists within the same account. */
async function assertOwner(accountId, ownerId) {
  const owner = await Owner.findOne({ _id: ownerId, accountId }).select('_id');
  if (!owner) throw ApiError.badRequest('Owner not found in this account');
}

async function createProperty(accountId, data) {
  await assertOwner(accountId, data.ownerId);
  const property = await Property.create({ accountId, ...data });
  return property;
}

async function listProperties(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);

  const filter = { accountId, isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.ownerId) filter.ownerId = query.ownerId;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { city: { $regex: query.search, $options: 'i' } },
      { postcode: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Property.find(filter).populate('ownerId', 'name email').sort(sort).skip(skip).limit(limit),
    Property.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit }, total) };
}

async function getPropertyById(accountId, id) {
  const property = await Property.findOne({ _id: id, accountId, isDeleted: { $ne: true } }).populate(
    'ownerId',
    'name email'
  );
  if (!property) throw ApiError.notFound('Property not found');
  return property;
}

async function updateProperty(accountId, id, data) {
  if (data.ownerId) await assertOwner(accountId, data.ownerId);

  const property = await Property.findOneAndUpdate(
    { _id: id, accountId, isDeleted: { $ne: true } },
    { $set: data },
    { new: true, runValidators: true }
  ).populate('ownerId', 'name email');
  if (!property) throw ApiError.notFound('Property not found');
  return property;
}

/** Soft-delete a property and its rooms. */
async function deleteProperty(accountId, id) {
  const now = new Date();
  const property = await Property.findOneAndUpdate(
    { _id: id, accountId, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: now } },
    { new: true }
  );
  if (!property) throw ApiError.notFound('Property not found');

  // Cascade soft-delete to the property's rooms so none are orphaned.
  await Room.updateMany(
    { propertyId: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: now } }
  );
  return property;
}

module.exports = {
  createProperty,
  listProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
};
