'use strict';

const express = require('express');

const ctrl = require('../controllers/owner.controller');
const schema = require('../validations/owner.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER);

router
  .route('/')
  .post(canManage, validate(schema.createOwner), ctrl.create)
  .get(validate(schema.listOwners), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getOwner), ctrl.getOne)
  .patch(canManage, validate(schema.updateOwner), ctrl.update)
  .delete(canManage, validate(schema.deleteOwner), ctrl.remove);

module.exports = router;
