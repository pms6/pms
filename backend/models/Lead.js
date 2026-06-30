'use strict';

const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    source: { type: String },
    status: { type: String, enum: ['new', 'qualified', 'converted', 'lost'], default: 'new' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
