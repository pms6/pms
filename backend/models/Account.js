'use strict';

const mongoose = require('mongoose');
 
/** Tenant root — owns every other scoped collection. */
const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['landlord', 'agency'], default: 'landlord' },
    contactEmail: { type: String, trim: true, lowercase: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
