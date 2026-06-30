'use strict';

const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rightToRentId: { type: mongoose.Schema.Types.ObjectId, ref: 'RightToRent' },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    status: { type: String, enum: ['active', 'former', 'prospect'], default: 'prospect' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);
