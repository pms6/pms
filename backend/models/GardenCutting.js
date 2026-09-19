import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// The office's "Garden Cutting" sheet: one row per garden cut, with who did it,
// what it cost, and the before / after photos and video that prove the job.
//
// The sheet's "sr" column is the row number and is not stored.
const gardenCuttingSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Optional link to the property record. The sheet is written as a plain
    // address and rows exist for addresses not yet in the portfolio, so the
    // text is what the sheet actually reads from.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, required: true },

    // "Garden Cutting Date" on the sheet.
    date: { type: Date, required: true, index: true },

    // Who did the cutting — the sheet's "Name" column.
    name: { type: String, trim: true, default: "" },

    cost: { type: Number, default: 0, min: 0 },

    // "Before Pictures + Videos" and "After Pictures + Videos". Lists, because
    // one garden is several photos rather than one.
    beforeFiles: { type: [attachmentSchema], default: [] },
    afterFiles: { type: [attachmentSchema], default: [] },

    notes: { type: String, trim: true, default: "" },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

gardenCuttingSchema.index({ organizationId: 1, isDeleted: 1, date: -1 });

export default mongoose.model("GardenCutting", gardenCuttingSchema);
