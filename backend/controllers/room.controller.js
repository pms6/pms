'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const roomService = require('../services/room.service');

const create = asyncHandler(async (req, res) => {
  const room = await roomService.createRoom(req.accountId, req.params.propertyId, req.body);
  return created(res, room, 'Room created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await roomService.listRooms(req.accountId, req.params.propertyId, req.query);
  return ok(res, items, 'Rooms fetched', meta);
});

const getOne = asyncHandler(async (req, res) => {
  const room = await roomService.getRoomById(req.accountId, req.params.propertyId, req.params.id);
  return ok(res, room, 'Room fetched');
});

const update = asyncHandler(async (req, res) => {
  const room = await roomService.updateRoom(
    req.accountId,
    req.params.propertyId,
    req.params.id,
    req.body
  );
  return ok(res, room, 'Room updated');
});

const remove = asyncHandler(async (req, res) => {
  await roomService.deleteRoom(req.accountId, req.params.propertyId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
