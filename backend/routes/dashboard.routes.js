'use strict';

const express = require('express');

const ctrl = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const { accountScope } = require('../middleware/accountScope');

const router = express.Router();

// Dashboard is readable by any authenticated user in the account.
router.use(authenticate, accountScope);

router.get('/stats', ctrl.stats);

module.exports = router;
