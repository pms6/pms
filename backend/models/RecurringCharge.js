'use strict';

const mongoose = require('mongoose');

const recurringChargeSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    type: { type: String },
    amount: { type: mongoose.Schema.Types.Decimal128 },
    frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly'], default: 'monthly' },
    nextRunDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecurringCharge', recurringChargeSchema);
