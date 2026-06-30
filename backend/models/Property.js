'use strict';

const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    name: { type: String, required: true, trim: true },
    addressLine1: { type: String },
    city: { type: String },
    postcode: { type: String },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    totalRooms: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Property', propertySchema);
