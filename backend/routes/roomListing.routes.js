'use strict';

const express = require('express');

const ctrl = require('../controllers/roomListing.controller');
const schema = require('../validations/roomListing.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { requireRole, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, accountScope);

const canManage = requireRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT);

router
  .route('/')
  .post(canManage, validate(schema.createListing), ctrl.create)
  .get(validate(schema.listListings), ctrl.list);

router
  .route('/:id')
  .get(validate(schema.getListing), ctrl.getOne)
  .patch(canManage, validate(schema.updateListing), ctrl.update)
  .delete(canManage, validate(schema.deleteListing), ctrl.remove);

module.exports = router;
