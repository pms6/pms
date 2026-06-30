'use strict';

const mongoose = require('mongoose');

/**
 * Unified compliance record. Covers EPC, Gas, EICR, FRA, PAT, Legionella,
 * Emergency Lighting, Fire Door and alarm checks via certType — scoped to a
 * property and optionally a room.
 */
const complianceCertificateSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    certType: {
      type: String,
      enum: ['EPC', 'Gas', 'EICR', 'FRA', 'PAT', 'Legionella', 'FireDoor', 'Alarm'],
      required: true,
    },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    status: { type: String, enum: ['valid', 'expiring', 'expired'], default: 'valid' },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  },
  { timestamps: true }
);

complianceCertificateSchema.index({ propertyId: 1, expiryDate: 1 });

module.exports = mongoose.model('ComplianceCertificate', complianceCertificateSchema);
