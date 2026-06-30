'use strict';

const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    name: { type: String, required: true, trim: true },
    trade: { type: String },
    contact: { type: mongoose.Schema.Types.Mixed },
    contractDocId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    rating: { type: Number, min: 0, max: 5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Supplier', supplierSchema);
