import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// The office's "Council Tax" sheet: one row per property, saying who the
// council tax account is registered to and what the instalments are.
//
//   Sr# | Property | Council | Account Holder Name | Account# | Move in Date |
//   Email | Details | Total | Instalments (amount, due date, paid on, proof) |
//   Paid | Outstanding
//
// The sheet's "Sr#" column is the row number and is not stored; an
// instalment's Sr# is likewise its place in the list.
//
// MUST stay in sync with the council tax columns in
// frontend/src/app/Shared/CouncilTaxBillsBoard.js.

// Whether the council tax has been paid. "" = not recorded, which is how every
// row entered before payment tracking existed reads.
//
// MUST stay in sync with COUNCIL_TAX_STATUSES in
// frontend/src/app/Shared/CouncilTaxBillsBoard.js.
export const COUNCIL_TAX_STATUSES = ["", "Pending", "Paid"];

// One instalment of the year's council tax: what is due, when, and the day it
// was paid. An instalment with a paidAt is paid; one without is outstanding.
const installmentSchema = new mongoose.Schema({
  amount: { type: Number, default: null, min: 0 },
  dueDate: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  // Proof of payment for this instalment — the receipt, a bank screenshot.
  files: { type: [attachmentSchema], default: [] },
});

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

    // The council the account is with (e.g. "Manchester City Council").
    councilName: { type: String, trim: true, default: "" },

    accountHolder: { type: String, trim: true, default: "" },
    // Council account numbers carry letters too (e.g. "6344193X").
    accountNumber: { type: String, trim: true, default: "" },
    moveInDate: { type: Date, default: null },
    email: { type: String, trim: true, default: "" },

    // Multi-line on the sheet: the tenant's name, date of birth, phone, the
    // council's web reference, single person discount — whatever was submitted.
    details: { type: String, trim: true, default: "" },

    // The year's council tax as the bill states it, entered by hand. null =
    // not entered, in which case the total is the sum of the instalments.
    // Paid is always the paid instalments; outstanding is total less paid.
    totalAmount: { type: Number, default: null, min: 0 },

    // As many instalments as the council's bill lists, in order.
    installments: { type: [installmentSchema], default: [] },

    // The two fixed columns the sheet had before instalments became a list.
    // Rows entered back then still read from these; the controller keeps them
    // mirroring the first two instalments. null, not 0, when blank — "not known
    // yet" and "nothing due" read differently.
    firstInstallment: { type: Number, default: null, min: 0 },
    secondInstallment: { type: Number, default: null, min: 0 },

    // Derived from the instalments once a row has any: Paid when every one is
    // paid, Pending otherwise.
    status: { type: String, enum: COUNCIL_TAX_STATUSES, default: "" },
    // Stamped when the status turns Paid, cleared when it turns back.
    paidAt: { type: Date, default: null },

    // The council's bill, payment receipts, discount letters.
    files: { type: [attachmentSchema], default: [] },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

councilTaxSchema.index({ organizationId: 1, isDeleted: 1, property: 1 });

// Paid rows always carry the day they were paid (today unless one was given);
// any other status has none.
councilTaxSchema.pre("save", function () {
  // With instalments the status is theirs to decide: the row is paid on the
  // day its last instalment was — and, when a total was entered, only once the
  // paid instalments cover it.
  if (this.installments.length) {
    const paidDates = this.installments.map((i) => i.paidAt).filter(Boolean);
    const paidSum = this.installments
      .filter((i) => i.paidAt)
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const coversTotal = this.totalAmount === null || this.totalAmount === undefined || paidSum >= this.totalAmount;
    const allPaid = paidDates.length === this.installments.length && coversTotal;
    this.status = allPaid ? "Paid" : "Pending";
    this.paidAt = allPaid ? new Date(Math.max(...paidDates.map((d) => d.getTime()))) : null;
    return;
  }

  if (this.status === "Paid") {
    if (!this.paidAt) this.paidAt = new Date();
  } else {
    this.paidAt = null;
  }
});

export default mongoose.model("CouncilTax", councilTaxSchema);
