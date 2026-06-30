'use strict';

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'trial', 'cancelled'], default: 'trial' },
    stripeCustomerId: { type: String },
    renewalDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
