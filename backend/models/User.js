'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ['admin', 'manager', 'agent', 'finance', 'tenant'],
      default: 'manager',
    },
    status: { type: String, enum: ['active', 'invited', 'disabled'], default: 'invited' },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
