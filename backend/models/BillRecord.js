import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// The office's "Bills Record" sheet: one row per utility payment at a
// property.
//
//   Sr# | Name of property | Date | Type | Payment name | Amount | Status | Bill
//
// The sheet's "Sr#" column is the row number and is not stored.
//
// MUST stay in sync with BILL_TYPES and BILL_STATUSES in
// frontend/src/app/Shared/CouncilTaxBillsBoard.js.

// The types the sheet's heading lists. Free text is still accepted — the list
// is a convenience, not a constraint.
export const BILL_TYPES = ["Octopus Energy", "Gas", "Water", "Electricity"];

export const BILL_STATUSES = ["", "Pending", "Done"];

const billRecordSchema = new mongoose.Schema(
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

    // Optional link to the property record; the address text is what the
    // sheet reads from.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, required: true },

    date: { type: Date, default: null, index: true },
    type: { type: String, trim: true, default: "" },

    // Who paid / what the payment was — the sheet writes things like
    // "30 top up done on 23 May" or the tenant's name here.
    paymentName: { type: String, trim: true, default: "" },

    amount: { type: Number, default: null, min: 0 },
    status: { type: String, enum: BILL_STATUSES, default: "" },

    // The sheet's "bill" column — the supplier or bill it relates to
    // ("good energy", "electricity").
    bill: { type: String, trim: true, default: "" },
    // The bill itself, when there is a copy of it.
    billFiles: { type: [attachmentSchema], default: [] },

    notes: { type: String, trim: true, default: "" },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

billRecordSchema.index({ organizationId: 1, isDeleted: 1, date: -1 });

export default mongoose.model("BillRecord", billRecordSchema);
