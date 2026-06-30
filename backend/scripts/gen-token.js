'use strict';

/**
 * Generate a test JWT access token for manual API testing (Postman, curl).
 * Usage:
 *   node scripts/gen-token.js                       # admin, random accountId
 *   node scripts/gen-token.js <accountId> <role>    # explicit values
 *
 * The token payload matches what middleware/auth.js expects:
 *   { sub: userId, accountId, role }
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const accountId = process.argv[2] || new mongoose.Types.ObjectId().toString();
const role = process.argv[3] || 'admin';
const userId = new mongoose.Types.ObjectId().toString();

const token = jwt.sign({ sub: userId, accountId, role }, env.jwt.accessSecret, {
  expiresIn: env.jwt.accessExpires,
});

console.log('\nAccess token (valid for %s):\n', env.jwt.accessExpires);
console.log(token);
console.log('\nPayload:', { sub: userId, accountId, role });
console.log('\nAuthorization header:\n');
console.log(`Bearer ${token}\n`);
