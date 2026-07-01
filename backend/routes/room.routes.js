'use strict';

const express = require('express');

const ctrl = require('../controllers/room.controller');
const schema = require('../validations/room.validation');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

// mergeParams so :propertyId from the parent property router is available here.
const router = express.Router({ mergeParams: true });

const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER);

router
  .route('/')
  .post(canManage, validate(schema.createRoom), ctrl.create)
  .get(validate(schema.listRooms), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getRoom), ctrl.getOne)
  .patch(canManage, validate(schema.updateRoom), ctrl.update)
  .delete(canManage, validate(schema.deleteRoom), ctrl.remove);

module.exports = router;
