'use strict';

const express = require('express');

const ctrl = require('../controllers/user.controller');
const schema = require('../validations/user.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Every user route requires a valid JWT and an account context.
router.use(authenticate, accountScope);

// Managing users is restricted to admins and managers.
const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER);

router
  .route('/')
  .post(canManage, validate(schema.createUser), ctrl.create)
  .get(validate(schema.listUsers), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getUser), ctrl.getOne)
  .patch(canManage, validate(schema.updateUser), ctrl.update)
  .delete(canManage, validate(schema.deleteUser), ctrl.remove);

module.exports = router;
