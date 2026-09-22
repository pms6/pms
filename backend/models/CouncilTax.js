import mongoose from "mongoose";

// The office's "Council Tax" sheet: one row per property, saying who the
// council tax account is registered to and what the instalments are.
//
//   Sr# | Property | Account Holder Name | Account# | Move in Date | Email |
//   Details | 1st Installment | 2nd Installment
//
// The sheet's "Sr#" column is the row number and is not stored.
//
// MUST stay in sync with the council tax columns in
// frontend/src/app/Shared/CouncilTaxBillsBoard.js.
const councilTaxSchema = new mongoose.Schema(
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
    // address and carries addresses not yet in the portfolio, so the text is
    // what the sheet actually reads from.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, required: true },

    accountHolder: { type: String, trim: true, default: "" },
    // Council account numbers carry letters too (e.g. "6344193X").
    accountNumber: { type: String, trim: true, default: "" },
    moveInDate: { type: Date, default: null },
    email: { type: String, trim: true, default: "" },

    // Multi-line on the sheet: the tenant's name, date of birth, phone, the
    // council's web reference, single person discount — whatever was submitted.
    details: { type: String, trim: true, default: "" },

    // null, not 0, when the sheet leaves the cell blank — "not known yet" and
    // "nothing due" read differently.
    firstInstallment: { type: Number, default: null, min: 0 },
    secondInstallment: { type: Number, default: null, min: 0 },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

councilTaxSchema.index({ organizationId: 1, isDeleted: 1, property: 1 });

export default mongoose.model("CouncilTax", councilTaxSchema);
