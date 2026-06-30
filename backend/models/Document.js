'use strict';

const mongoose = require('mongoose');

/**
 * Polymorphic file store. ownerType + ownerId (refPath) lets any record
 * attach files. The actual binary lives in Cloudinary; we persist the URL.
 */
const documentSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    ownerType: { type: String },
    ownerId: { type: mongoose.Schema.Types.ObjectId, refPath: 'ownerType' },
    fileName: { type: String },
    url: { type: String },
    fileType: { type: String },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

documentSchema.index({ ownerType: 1, ownerId: 1 });

module.exports = mongoose.model('Document', documentSchema);
