'use strict';

const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenancy', required: true },
    period: { type: String },
    amountDue: { type: mongoose.Schema.Types.Decimal128 },
    dueDate: { type: Date },
    status: { type: String, enum: ['unpaid', 'paid', 'partial', 'overdue'], default: 'unpaid' },
    lateFee: { type: mongoose.Schema.Types.Decimal128 },
  },
  { timestamps: true }
);

invoiceSchema.index({ tenancyId: 1, status: 1 });
invoiceSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
