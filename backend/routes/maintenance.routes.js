'use strict';

const express = require('express');

const ctrl = require('../controllers/maintenance.controller');
const schema = require('../validations/maintenance.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

// Agents can also raise/track requests; only admin/manager may delete.
const canRaise = requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT);
const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER);

router
  .route('/')
  .post(canRaise, validate(schema.createMaintenance), ctrl.create)
  .get(validate(schema.listMaintenance), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getMaintenance), ctrl.getOne)
  .patch(canRaise, validate(schema.updateMaintenance), ctrl.update)
  .delete(canManage, validate(schema.deleteMaintenance), ctrl.remove);

module.exports = router;
