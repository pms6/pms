'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/ApiResponse');
const userService = require('../services/user.service');

/** POST /users */
const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.accountId, req.body);
  return created(res, user, 'User created');
});

/** GET /users */
const list = asyncHandler(async (req, res) => {
  const { items, meta } = await userService.listUsers(req.accountId, req.query);
  return ok(res, items, 'Users fetched', meta);
});

/** GET /users/:id */
const getOne = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.accountId, req.params.id);
  return ok(res, user, 'User fetched');
});

/** PATCH /users/:id */
const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.accountId, req.params.id, req.body);
  return ok(res, user, 'User updated');
});

/** DELETE /users/:id */
const remove = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.accountId, req.params.id);
  return noContent(res);
});

module.exports = { create, list, getOne, update, remove };
