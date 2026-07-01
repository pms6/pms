'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security & infra middleware
app.use(helmet());
// With credentials (cookies), the ACAO header cannot be "*". When CORS_ORIGIN
// is unset we reflect the request origin (origin: true) so dev works out of the
// box; in production set CORS_ORIGIN to the exact frontend URL.
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin, credentials: true }));
app.use(compression());
if (!env.isProd) app.use(morgan('dev'));

// Body parsing (Stripe webhooks need the raw body, mount those before this in their route)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// API routes
app.use(env.apiPrefix, routes);

// 404 + error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
