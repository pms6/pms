'use strict';

const mongoose = require('mongoose');

const utilityBillSchema = new mongoose.Schema(
  {
    utilityAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UtilityAccount',
      required: true,
      index: true,
    },
    period: { type: String },
    amount: { type: mongoose.Schema.Types.Decimal128 },
    dueDate: { type: Date },
    status: { type: String, enum: ['due', 'paid', 'overdue'], default: 'due' },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UtilityBill', utilityBillSchema);
