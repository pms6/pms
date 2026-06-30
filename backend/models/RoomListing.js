'use strict';

const mongoose = require('mongoose');

const roomListingSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    title: { type: String },
    rentAdvertised: { type: mongoose.Schema.Types.Decimal128 },
    availableFrom: { type: Date },
    status: { type: String, enum: ['draft', 'published', 'let'], default: 'draft' },
    platforms: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoomListing', roomListingSchema);
