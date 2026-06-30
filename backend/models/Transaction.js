'use strict';

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    type: { type: String, enum: ['income', 'expense'] },
    category: { type: String },
    amount: { type: mongoose.Schema.Types.Decimal128 },
    date: { type: Date },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
