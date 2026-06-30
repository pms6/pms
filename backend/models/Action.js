'use strict';

const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String },
    priority: { type: String, enum: ['low', 'med', 'high'], default: 'med' },
    status: { type: String, enum: ['pending', 'done', 'overdue'], default: 'pending' },
    dueDate: { type: Date },
    relatedRef: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Action', actionSchema);
