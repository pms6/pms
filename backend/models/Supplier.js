import mongoose from "mongoose";

// Default specialism options and the permission steps a supplier may skip.
// MUST stay in sync with SPECIALISMS / SUPPLIER_PERMISSIONS in
// frontend/src/app/admin/_data/dummy.js. specialisms is open-ended (the UI can
// add custom ones), so these are defaults rather than a hard enum.
export const SPECIALISMS = [
  "Builder",
  "Cleaner",
  "Electrician",
  "Handyman",
  "Plumber",
  "Gas Engineer",
];

export const SUPPLIER_PERMISSIONS = [
  "Quote Submission",
  "Invoice Submission",
  "Date Proposal",
  "Job Completion",
];

// Permission flags — keys mirror SUPPLIER_PERMISSIONS exactly so the object
// round-trips to/from the client unchanged.
const permissionsSchema = new mongoose.Schema(
  {
    "Quote Submission": { type: Boolean, default: false },
    "Invoice Submission": { type: Boolean, default: false },
    "Date Proposal": { type: Boolean, default: false },
    "Job Completion": { type: Boolean, default: false },
  },
  { _id: false }
);

const supplierSchema = new mongoose.Schema(
  {
    // ============================
    // SaaS Relationships
    // ============================
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

    // ============================
    // Company & contact
    // ============================
    company: { type: String, trim: true, required: true },
    contactForename: { type: String, trim: true, default: "" },
    contactSurname: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    preferred: { type: Boolean, default: false },

    // ============================
    // Classification
    // ============================
    specialisms: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    // Free-text names of private documents (insurance, licences, contracts).
    documents: { type: [String], default: [] },

    permissions: { type: permissionsSchema, default: () => ({}) },

    notes: { type: String, trim: true, default: "" },

    unpaidInvoices: { type: Number, default: 0 },

    // ============================
    // Lifecycle
    // ============================
    archived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

supplierSchema.index({ organizationId: 1, isDeleted: 1 });

export default mongoose.model("Supplier", supplierSchema);
