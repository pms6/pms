'use strict';

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor' },
    roomNumber: { type: String },
    roomType: { type: String, enum: ['single', 'double', 'ensuite'] },
    capacity: { type: Number, default: 1 },
    rentAmount: { type: mongoose.Schema.Types.Decimal128 },
    status: { type: String, enum: ['vacant', 'occupied', 'maint'], default: 'vacant' },
    availableFrom: { type: Date },
    amenities: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

roomSchema.index({ propertyId: 1, status: 1 });

module.exports = mongoose.model('Room', roomSchema);
