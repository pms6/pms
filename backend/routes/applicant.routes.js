'use strict';

const express = require('express');

const ctrl = require('../controllers/applicant.controller');
const schema = require('../validations/applicant.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT);

router
  .route('/')
  .post(canManage, validate(schema.createApplicant), ctrl.create)
  .get(validate(schema.listApplicants), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getApplicant), ctrl.getOne)
  .patch(canManage, validate(schema.updateApplicant), ctrl.update)
  .delete(canManage, validate(schema.deleteApplicant), ctrl.remove);

module.exports = router;
