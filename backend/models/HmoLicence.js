'use strict';

const mongoose = require('mongoose');

const hmoLicenceSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    licenceNumber: { type: String },
    issuingAuthority: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    maxOccupants: { type: Number },
    conditions: { type: [String], default: [] },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    status: { type: String, enum: ['active', 'expired', 'pending'], default: 'pending' },
  },
  { timestamps: true }
);

hmoLicenceSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('HmoLicence', hmoLicenceSchema);
