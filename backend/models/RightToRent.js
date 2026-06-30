'use strict';

const mongoose = require('mongoose');

const rightToRentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    status: { type: String, enum: ['verified', 'pending', 'expired'], default: 'pending' },
    verificationDate: { type: Date },
    expiryDate: { type: Date },
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('RightToRent', rightToRentSchema);
