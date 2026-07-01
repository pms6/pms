'use strict';

const { Room, Property } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

/**
 * Rooms have no accountId of their own — they are scoped through their parent
 * Property. Every room operation first proves the property belongs to the
 * caller's account, which is the tenant-isolation enforcement point for rooms.
 */
async function assertProperty(accountId, propertyId) {
  const property = await Property.findOne({
    _id: propertyId,
    accountId,
    isDeleted: { $ne: true },
  }).select('_id');
  if (!property) throw ApiError.notFound('Property not found');
}

/** Keep Property.totalRooms in sync with its live room count. */
async function syncTotalRooms(propertyId) {
  const count = await Room.countDocuments({ propertyId, isDeleted: { $ne: true } });
  await Property.updateOne({ _id: propertyId }, { $set: { totalRooms: count } });
}

/** Serialize a room, converting Decimal128 rent to a plain string. */
function sanitize(roomDoc) {
  if (!roomDoc) return roomDoc;
  const obj = roomDoc.toObject ? roomDoc.toObject() : roomDoc;
  obj.rentAmount = obj.rentAmount != null ? obj.rentAmount.toString() : null;
  return obj;
}

async function createRoom(accountId, propertyId, data) {
  await assertProperty(accountId, propertyId);
  const room = await Room.create({ propertyId, ...data });
  await syncTotalRooms(propertyId);
  return sanitize(room);
}

async function listRooms(accountId, propertyId, query = {}) {
  await assertProperty(accountId, propertyId);
  const { page, limit, skip, sort } = parsePagination(query);

  const filter = { propertyId, isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Room.find(filter).sort(sort).skip(skip).limit(limit),
    Room.countDocuments(filter),
  ]);
  return { items: items.map(sanitize), meta: buildMeta({ page, limit }, total) };
}

async function getRoomById(accountId, propertyId, id) {
  await assertProperty(accountId, propertyId);
  const room = await Room.findOne({ _id: id, propertyId, isDeleted: { $ne: true } });
  if (!room) throw ApiError.notFound('Room not found');
  return sanitize(room);
}

async function updateRoom(accountId, propertyId, id, data) {
  await assertProperty(accountId, propertyId);
  const room = await Room.findOneAndUpdate(
    { _id: id, propertyId, isDeleted: { $ne: true } },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!room) throw ApiError.notFound('Room not found');
  return sanitize(room);
}

async function deleteRoom(accountId, propertyId, id) {
  await assertProperty(accountId, propertyId);
  const room = await Room.findOneAndUpdate(
    { _id: id, propertyId, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date() } },
    { new: true }
  );
  if (!room) throw ApiError.notFound('Room not found');
  await syncTotalRooms(propertyId);
  return sanitize(room);
}

module.exports = { createRoom, listRooms, getRoomById, updateRoom, deleteRoom };
