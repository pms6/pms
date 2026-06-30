'use strict';

const express = require('express');

const router = express.Router();

/**
 * Central API router, mounted under env.apiPrefix (default /api/v1).
 * Register module routers here as they are built, following the
 * phased build order in DATA_MODEL.md / the SRS.
 *
 * Example:
 *   const authRoutes = require('./auth.routes');
 *   router.use('/auth', authRoutes);
 */

router.get('/', (_req, res) =>
  res.json({
    success: true,
    message: 'PMS API v1',
    docs: 'See DATA_MODEL.md for the schema and build order',
  })
);

// Phase 1 — Core platform
router.use('/auth', require('./auth.routes'));
// router.use('/accounts', require('./account.routes'));
router.use('/users', require('./user.routes'));
// router.use('/properties', require('./property.routes'));
// router.use('/rooms', require('./room.routes'));

module.exports = router;
