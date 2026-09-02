import mongoose from "mongoose";

// Reference data — the app's replacement for "Reference Data template .xlsx".
//
// One row per tenant, holding the three references the office collects before
// a let: the previous landlord, the employer, and a next of kin.
//
// Every contact field is a free string rather than a phone/email type. The
// sheet routinely puts prose where a number belongs — "He was lived with his
// parents", "Daniela Ilie: 7909459390", "Manager=447449107507", a bare "/" for
// "none" — and that wording is the reference. Validating it away would lose
// the only record of why there is no landlord to call.

// The relationship column on the sheet: Friend, Sister, Girlfriend, and so on.
// A suggestion list for the UI, not an enum — the field stays free text so an
// unusual relationship is recorded as written.
export const KIN_RELATIONSHIPS = [
  "Parent",
  "Mother",
  "Father",
  "Sibling",
  "Sister",
  "Brother",
  "Partner",
  "Spouse",
  "Girlfriend",
  "Boyfriend",
  "Friend",
  "Colleague",
  "Other",
];

// A reference the office has chased but not yet confirmed is materially
// different from one that checked out, and different again from one that came
// back bad. The sheet has no such column — it records only what was collected —
// but the register is where a referencing chase is actually worked.
export const REFERENCE_STATUS = ["PENDING", "VERIFIED", "FAILED", "NOT_REQUIRED"];

const contactSchema = new mongoose.Schema(
  {
    // Who the reference is — a landlord's or manager's name, where the sheet
    // gives one.
    name: { type: String, trim: true, default: "" },
    contact: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    // The sheet's free text when it is neither a number nor an address, e.g.
    // "He was lived with her partner".
    note: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: REFERENCE_STATUS,
      default: "PENDING",
    },
  },
  { _id: false }
);

const referenceDataSchema = new mongoose.Schema(
  {
    // ============================
    // SaaS relationships
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

    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
    // The check-in this tenant's references were collected for. Optional: the
    // references are usually taken before the check-in exists.
    checkInId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckIn", default: null, index: true },

    // ============================
    // Display fields
    // ============================
    property: { type: String, trim: true, required: true },
    room: { type: String, trim: true, default: "" },
    tenant: { type: String, trim: true, required: true },

    tenantEmail: { type: String, trim: true, lowercase: true, default: "" },
    tenantPhone: { type: String, trim: true, default: "" },

    // ============================
    // The three references
    // ============================
    // "Ex Landlord" on the sheet.
    exLandlord: { type: contactSchema, default: () => ({}) },
    // "Job" on the sheet — the employer or their manager.
    employer: { type: contactSchema, default: () => ({}) },
    // "Kin details" on the sheet. Carries the relationship as well.
    nextOfKin: {
      relationship: { type: String, trim: true, default: "" },
      name: { type: String, trim: true, default: "" },
      contact: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      note: { type: String, trim: true, default: "" },
      status: {
        type: String,
        enum: REFERENCE_STATUS,
        default: "PENDING",
      },
    },

    // ============================
    // Documents
    // ============================
    // The sheet's Documents column is a label ("Zahra Documents") pointing at a
    // folder somewhere else. Real files are attached here instead; the label is
    // kept in documentsNote so an imported row does not lose its pointer.
    //
    // Any file type is accepted. Reference paperwork is whatever the referee
    // actually sent — a scanned tenancy agreement, a payslip spreadsheet, a
    // right-to-rent screenshot, an exported email — and a format whitelist here
    // would only push those files back into somebody's inbox. `format` and
    // `bytes` are stored so the UI can label and size an attachment without
    // fetching it, and `publicId` so it can be removed from Cloudinary later.
    documents: [
      {
        name: { type: String, trim: true, default: "" },
        url: { type: String, trim: true, required: true },
        publicId: { type: String, trim: true, default: "" },
        format: { type: String, trim: true, default: "" },
        bytes: { type: Number, default: 0, min: 0 },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    documentsNote: { type: String, trim: true, default: "" },

    // The sheet is filed by month ("February"), so the register is too.
    recordedOn: { type: Date, default: Date.now, index: true },

    notes: { type: String, trim: true, default: "" },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

referenceDataSchema.index({ organizationId: 1, isDeleted: 1, recordedOn: -1 });

export default mongoose.model("ReferenceData", referenceDataSchema);
