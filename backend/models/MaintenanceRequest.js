'use strict';

const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    category: { type: String },
    priority: { type: String, enum: ['low', 'med', 'high', 'urgent'], default: 'med' },
    status: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'closed'],
      default: 'open',
    },
    cost: { type: mongoose.Schema.Types.Decimal128 },
    photoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
