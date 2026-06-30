'use strict';

const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema(
  {
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenancy', required: true, index: true },
    amount: { type: mongoose.Schema.Types.Decimal128 },
    schemeName: { type: String },
    schemeRef: { type: String },
    protectionDate: { type: Date },
    certificateDocId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    status: { type: String, enum: ['held', 'protected', 'released'], default: 'held' },
    releaseAmount: { type: mongoose.Schema.Types.Decimal128 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Deposit', depositSchema);
