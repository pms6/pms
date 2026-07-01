'use strict';

const express = require('express');

const ctrl = require('../controllers/account.controller');
const schema = require('../validations/account.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Every account route requires a valid JWT and an account context.
router.use(authenticate, accountScope);

router
  .route('/me')
  .get(ctrl.getMine)
  .patch(requireRole(ROLES.ADMIN), validate(schema.updateAccount), ctrl.updateMine);

module.exports = router;
