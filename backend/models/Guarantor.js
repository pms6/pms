'use strict';

const mongoose = require('mongoose');

const guarantorSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String },
    contact: { type: mongoose.Schema.Types.Mixed },
    verificationStatus: { type: String, enum: ['pending', 'verified'], default: 'pending' },
    agreementDocId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Guarantor', guarantorSchema);
