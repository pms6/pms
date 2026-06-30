'use strict';

const express = require('express');

const ctrl = require('../controllers/auth.controller');
const schema = require('../validations/auth.validation');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Public — no token required.
router.post('/register', validate(schema.register), ctrl.register);
router.post('/login', validate(schema.login), ctrl.login);
router.post('/refresh', validate(schema.refresh), ctrl.refresh);

// Protected — requires a valid access token.
router.get('/me', authenticate, accountScope, ctrl.me);

module.exports = router;
