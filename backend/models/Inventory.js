'use strict';

const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenancy', index: true },
    type: { type: String, enum: ['move_in', 'move_out'] },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    damages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inventory', inventorySchema);
