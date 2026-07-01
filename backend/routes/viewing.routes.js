'use strict';

const express = require('express');

const ctrl = require('../controllers/viewing.controller');
const schema = require('../validations/viewing.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT);

router
  .route('/')
  .post(canManage, validate(schema.createViewing), ctrl.create)
  .get(validate(schema.listViewings), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getViewing), ctrl.getOne)
  .patch(canManage, validate(schema.updateViewing), ctrl.update)
  .delete(canManage, validate(schema.deleteViewing), ctrl.remove);

module.exports = router;
