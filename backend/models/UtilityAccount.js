'use strict';

const mongoose = require('mongoose');

const utilityAccountSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    utilityType: { type: String, enum: ['elec', 'gas', 'water', 'internet'] },
    provider: { type: String },
    accountNumber: { type: String },
    tariff: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UtilityAccount', utilityAccountSchema);
