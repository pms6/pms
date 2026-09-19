import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// The office's "Court Claims" sheet: one row per claim, with who is claiming
// from whom, how much, when a response is due, and the paperwork behind it.
//
// The sheet's "sr" column is the row number and is not stored.
const courtClaimSchema = new mongoose.Schema(
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

    // "Claim Date" on the sheet.
    claimDate: { type: Date, required: true, index: true },

    // Who is bringing the claim, and who it is brought against.
    claimBy: { type: String, trim: true, default: "" },
    claimTo: { type: String, trim: true, default: "" },

    // The sheet's Amount, Rent and Deposit columns. Amount is what is being
    // claimed in total; Rent and Deposit are the two figures it is made up
    // from or measured against. Kept as separate entries rather than derived,
    // because the office writes each one down as it stands on the claim.
    amount: { type: Number, default: 0, min: 0 },
    rent: { type: Number, default: 0, min: 0 },
    deposit: { type: Number, default: 0, min: 0 },

    // "Deadline to Respond" — null when no response date has been set.
    deadlineToRespond: { type: Date, default: null },

    // The short reason on the sheet, and the longer write-up behind it.
    claimReason: { type: String, trim: true, default: "" },
    details: { type: String, trim: true, default: "" },

    // Court papers, letters, photos, video — whatever backs the claim.
    files: { type: [attachmentSchema], default: [] },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

courtClaimSchema.index({ organizationId: 1, isDeleted: 1, claimDate: -1 });

export default mongoose.model("CourtClaim", courtClaimSchema);
