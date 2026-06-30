'use strict';

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenancy' },
    amount: { type: mongoose.Schema.Types.Decimal128 },
    method: { type: String, enum: ['card', 'bank', 'cash'], default: 'card' },
    paidAt: { type: Date },
    stripePaymentId: { type: String },
    receiptDocId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
