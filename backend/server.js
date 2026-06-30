'use strict';

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDB, disconnectDB } = require('./config/db');

let server;

async function start() {
  await connectDB();
  server = app.listen(env.port, () => {
    logger.info(`PMS API listening on port ${env.port} (${env.nodeEnv})`);
    logger.info(`Base URL: http://localhost:${env.port}${env.apiPrefix}`);
  });
}

async function shutdown(signal) {
  logger.warn(`${signal} received, shutting down gracefully...`);
  if (server) server.close();
  await disconnectDB();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
