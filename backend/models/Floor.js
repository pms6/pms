'use strict';

const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    name: { type: String },
    level: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Floor', floorSchema);
