'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

/**
 * Establish the MongoDB connection. Call once at boot (server.js).
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      autoIndex: !env.isProd, // build indexes automatically in dev only
    });
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    throw err;
  }
}

async function disconnectDB() {
  await mongoose.connection.close();
  logger.info('MongoDB disconnected');
}

module.exports = { connectDB, disconnectDB };
