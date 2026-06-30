'use strict';

const mongoose = require('mongoose');

const viewingSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scheduledAt: { type: Date },
    status: { type: String, enum: ['scheduled', 'done', 'cancelled'], default: 'scheduled' },
    feedback: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Viewing', viewingSchema);
