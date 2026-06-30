'use strict';

const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    bedLabel: { type: String },
    status: { type: String, enum: ['vacant', 'occupied'], default: 'vacant' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bed', bedSchema);
