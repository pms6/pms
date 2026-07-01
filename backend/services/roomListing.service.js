'use strict';

const { RoomListing, Room, Property } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

/** Room ids that belong to this account's (non-deleted) properties. */
async function accountRoomIds(accountId) {
  const props = await Property.find({ accountId, isDeleted: { $ne: true } }).select('_id').lean();
  const propertyIds = props.map((p) => p._id);
  const rooms = await Room.find({ propertyId: { $in: propertyIds }, isDeleted: { $ne: true } })
    .select('_id')
    .lean();
  return rooms.map((r) => r._id);
}

/** Confirm a room belongs to the account (for writes). */
async function assertRoom(accountId, roomId) {
  const room = await Room.findOne({ _id: roomId, isDeleted: { $ne: true } }).select('propertyId');
  if (!room) throw ApiError.badRequest('Room not found');
  const owned = await Property.exists({ _id: room.propertyId, accountId, isDeleted: { $ne: true } });
  if (!owned) throw ApiError.badRequest('Room not found in this account');
}

function sanitize(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.rentAdvertised = obj.rentAdvertised != null ? obj.rentAdvertised.toString() : null;
  return obj;
}

async function createListing(accountId, data) {
  await assertRoom(accountId, data.roomId);
  const doc = await RoomListing.create(data);
  return sanitize(await doc.populate('roomId', 'roomNumber'));
}

async function listListings(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const roomIds = await accountRoomIds(accountId);

  const filter = { roomId: { $in: roomIds } };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    RoomListing.find(filter).populate('roomId', 'roomNumber').sort(sort).skip(skip).limit(limit),
    RoomListing.countDocuments(filter),
  ]);
  return { items: items.map(sanitize), meta: buildMeta({ page, limit }, total) };
}

/** Find a listing while proving its room belongs to the account. */
async function findScoped(accountId, id) {
  const roomIds = await accountRoomIds(accountId);
  const doc = await RoomListing.findOne({ _id: id, roomId: { $in: roomIds } }).populate(
    'roomId',
    'roomNumber'
  );
  if (!doc) throw ApiError.notFound('Listing not found');
  return doc;
}

async function getListingById(accountId, id) {
  return sanitize(await findScoped(accountId, id));
}

async function updateListing(accountId, id, data) {
  const doc = await findScoped(accountId, id);
  Object.assign(doc, data);
  await doc.save();
  return sanitize(doc);
}

async function deleteListing(accountId, id) {
  const doc = await findScoped(accountId, id);
  await doc.deleteOne();
  return sanitize(doc);
}

module.exports = {
  createListing,
  listListings,
  getListingById,
  updateListing,
  deleteListing,
};
