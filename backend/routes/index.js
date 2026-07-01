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
router.use('/accounts', require('./account.routes'));
router.use('/users', require('./user.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/owners', require('./owner.routes'));
router.use('/properties', require('./property.routes')); // mounts nested /:propertyId/rooms

// Phase 2 — Lettings
router.use('/leads', require('./lead.routes'));
router.use('/viewings', require('./viewing.routes'));
router.use('/applicants', require('./applicant.routes'));
router.use('/listings', require('./roomListing.routes'));

// Phase 4 — Operations & compliance (started early for the manager dashboard)
router.use('/maintenance', require('./maintenance.routes'));
router.use('/compliance', require('./compliance.routes'));

module.exports = router;
