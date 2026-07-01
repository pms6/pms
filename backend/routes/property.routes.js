'use strict';

const express = require('express');

const ctrl = require('../controllers/property.controller');
const schema = require('../validations/property.validation');
const roomRoutes = require('./room.routes');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER);

router
  .route('/')
  .post(canManage, validate(schema.createProperty), ctrl.create)
  .get(validate(schema.listProperties), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getProperty), ctrl.getOne)
  .patch(canManage, validate(schema.updateProperty), ctrl.update)
  .delete(canManage, validate(schema.deleteProperty), ctrl.remove);

// Nested rooms: /properties/:propertyId/rooms
router.use('/:propertyId/rooms', roomRoutes);

module.exports = router;
