'use strict';

const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    name: { type: String },
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
    referenceStatus: { type: String, enum: ['pending', 'passed', 'failed'], default: 'pending' },
    holdingDeposit: { type: mongoose.Schema.Types.Decimal128 },
    onboardingStatus: { type: String, enum: ['in_progress', 'complete'], default: 'in_progress' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Applicant', applicantSchema);
