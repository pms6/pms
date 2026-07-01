'use strict';

const express = require('express');

const ctrl = require('../controllers/compliance.controller');
const schema = require('../validations/compliance.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER);

router
  .route('/')
  .post(canManage, validate(schema.createCompliance), ctrl.create)
  .get(validate(schema.listCompliance), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getCompliance), ctrl.getOne)
  .patch(canManage, validate(schema.updateCompliance), ctrl.update)
  .delete(canManage, validate(schema.deleteCompliance), ctrl.remove);

module.exports = router;
