'use strict';

const { Owner, Property } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

async function createOwner(accountId, data) {
  const owner = await Owner.create({ accountId, ...data });
  return owner;
}

async function listOwners(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { accountId };
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Owner.find(filter).sort(sort).skip(skip).limit(limit),
    Owner.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit }, total) };
}

async function getOwnerById(accountId, id) {
  const owner = await Owner.findOne({ _id: id, accountId });
  if (!owner) throw ApiError.notFound('Owner not found');
  return owner;
}

async function updateOwner(accountId, id, data) {
  const owner = await Owner.findOneAndUpdate(
    { _id: id, accountId },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!owner) throw ApiError.notFound('Owner not found');
  return owner;
}

async function deleteOwner(accountId, id) {
  // Protect referential integrity — don't orphan properties.
  const inUse = await Property.exists({ accountId, ownerId: id, isDeleted: { $ne: true } });
  if (inUse) throw ApiError.conflict('Owner has properties and cannot be deleted');

  const owner = await Owner.findOneAndDelete({ _id: id, accountId });
  if (!owner) throw ApiError.notFound('Owner not found');
  return owner;
}

module.exports = { createOwner, listOwners, getOwnerById, updateOwner, deleteOwner };
