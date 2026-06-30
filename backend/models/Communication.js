'use strict';

const mongoose = require('mongoose');

const communicationSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    channel: { type: String, enum: ['email', 'notice', 'announcement'] },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    toRefs: { type: [String], default: [] },
    subject: { type: String },
    body: { type: String },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Communication', communicationSchema);
