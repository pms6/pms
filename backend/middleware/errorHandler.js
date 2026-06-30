'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');

/** 404 handler for unmatched routes. Mount after all routes. */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Global error handler. Must be the last middleware (4 args). */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  // Normalize common mongoose errors into ApiError.
  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((e) => ({ path: e.path, message: e.message }));
    error = ApiError.badRequest('Validation failed', details);
  } else if (error.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
  } else if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {}).join(', ');
    error = ApiError.conflict(`Duplicate value for: ${field}`);
  } else if (!(error instanceof ApiError)) {
    logger.error(error.stack || error.message);
    error = new ApiError(500, env.isProd ? 'Internal server error' : error.message);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    details: error.details,
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
