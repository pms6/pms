import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// A customised invoice — a repair recharge to a tenant, a management fee to a
// landlord, a deposit deduction — with its own line items, VAT and payments.
//
// Rent is not invoiced here. RentCharge is the rent ledger and stays the one
// place a month's rent lives; this is for everything that is not rent.
//
// "Overdue" is never stored by the system. It is derived on read from the due
// date (see effectiveStatus in invoice.controller.js), for the same reason the
// Task model derives it: a stored "Overdue" goes stale the moment the invoice
// is paid, and a stored "Issued" goes stale the day it passes its due date.
//
// MUST stay in sync with INVOICE_STATUSES in frontend/src/app/utils/invoices.js.
export const INVOICE_STATUSES = ["Draft", "Issued", "Paid", "Partially Paid", "Overdue", "Cancelled"];
export const BILL_TO_TYPES = ["Tenant", "Landlord", "Other"];

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, required: true },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0 },
    // Percent, e.g. 20 for standard-rate UK VAT. 0 = no VAT on this line.
    vatRate: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, default: Date.now },
    method: { type: String, trim: true, default: "" },
    reference: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    recordedByEmail: { type: String, trim: true, default: "" },
  },
  { _id: true, timestamps: true }
);

// The company and payment details printed on the invoice. Frozen onto the
// invoice when it is issued so a later change of bank account or address in
// Settings does not rewrite an invoice already sent.
const issuerSchema = new mongoose.Schema(
  {
    name: String,
    legalName: String,
    address: String,
    phone: String,
    email: String,
    website: String,
    logo: String,
    vatNumber: String,
    companyNumber: String,
    bankName: String,
    accountName: String,
    sortCode: String,
    accountNumber: String,
    iban: String,
    swift: String,
    paymentInstructions: String,
    footer: String,
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, required: true },
    note: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    byEmail: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByEmail: { type: String, trim: true, default: "" },

    // Automatic and unique per organisation: prefix + running number.
    number: { type: String, trim: true, required: true },
    seq: { type: Number, required: true },

    // The stored lifecycle state; see the note above about "Overdue".
    status: { type: String, enum: INVOICE_STATUSES, default: "Draft", index: true },

    invoiceDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, default: null, index: true },

    // ============================
    // Who is being billed
    // ============================
    billToType: { type: String, enum: BILL_TO_TYPES, default: "Tenant" },
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenancy", default: null, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", default: null, index: true },
    billTo: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      address: { type: String, trim: true, default: "" },
    },

    // ============================
    // What it is about
    // ============================
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    property: { type: String, trim: true, default: "" },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "TenantCase", default: null, index: true },

    lineItems: { type: [lineItemSchema], default: [] },
    discountType: { type: String, enum: ["amount", "percent"], default: "amount" },
    discountValue: { type: Number, default: 0, min: 0 },

    // Calculated on the server on every save (see computeTotals) — never
    // trusted from the client.
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    vatTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    payments: { type: [paymentSchema], default: [] },

    notes: { type: String, trim: true, default: "" },
    terms: { type: String, trim: true, default: "" },

    issuer: { type: issuerSchema, default: null },

    // Receipts and supporting documents.
    files: { type: [attachmentSchema], default: [] },

    issuedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    lastSentAt: { type: Date, default: null },
    lastSentTo: { type: String, trim: true, default: "" },

    history: { type: [historySchema], default: [] },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

invoiceSchema.index({ organizationId: 1, number: 1 }, { unique: true });
invoiceSchema.index({ organizationId: 1, isDeleted: 1, invoiceDate: -1 });

export default mongoose.model("Invoice", invoiceSchema);
