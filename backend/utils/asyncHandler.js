'use strict';

/**
 * Wrap an async express handler so rejected promises reach next()
 * instead of crashing the process.
 */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
