'use strict';

const mongoose = require('mongoose');

const ownerSettlementSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    period: { type: String },
    grossIncome: { type: mongoose.Schema.Types.Decimal128 },
    expenses: { type: mongoose.Schema.Types.Decimal128 },
    netPayout: { type: mongoose.Schema.Types.Decimal128 },
    status: { type: String, enum: ['draft', 'paid'], default: 'draft' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OwnerSettlement', ownerSettlementSchema);
