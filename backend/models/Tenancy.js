'use strict';

const mongoose = require('mongoose');

const tenancySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    bedId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bed' },
    // NOTE: single tenant per agreement. For joint tenancies switch to tenantIds: [ObjectId].
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    rentAmount: { type: mongoose.Schema.Types.Decimal128 },
    frequency: { type: String, enum: ['weekly', 'monthly'], default: 'monthly' },
    status: { type: String, enum: ['active', 'ended', 'renewed', 'notice'], default: 'active' },
    agreementDocId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    moveInDate: { type: Date },
    moveOutDate: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

tenancySchema.index({ roomId: 1, status: 1 });
tenancySchema.index({ tenantId: 1 });

module.exports = mongoose.model('Tenancy', tenancySchema);
