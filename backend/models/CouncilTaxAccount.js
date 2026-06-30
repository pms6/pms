'use strict';

const mongoose = require('mongoose');

const councilTaxAccountSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    council: { type: String },
    referenceNumber: { type: String },
    band: { type: String },
    annualAmount: { type: mongoose.Schema.Types.Decimal128 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CouncilTaxAccount', councilTaxAccountSchema);
