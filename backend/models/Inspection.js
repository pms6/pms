'use strict';

const mongoose = require('mongoose');

const inspectionSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    inspectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['routine', 'move_in', 'move_out', 'safety'] },
    scheduledAt: { type: Date },
    findings: { type: String },
    photoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
    status: { type: String, enum: ['scheduled', 'completed'], default: 'scheduled' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inspection', inspectionSchema);
