'use strict';

const express = require('express');

const ctrl = require('../controllers/lead.controller');
const schema = require('../validations/lead.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

// Lettings is handled by agents as well as admin/manager.
const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT);

router
  .route('/')
  .post(canManage, validate(schema.createLead), ctrl.create)
  .get(validate(schema.listLeads), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getLead), ctrl.getOne)
  .patch(canManage, validate(schema.updateLead), ctrl.update)
  .delete(canManage, validate(schema.deleteLead), ctrl.remove);

module.exports = router;
