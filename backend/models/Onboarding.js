import mongoose from "mongoose";

// Onboarding pipeline stages — MUST stay in sync with ONBOARDING_STAGES in
// frontend/src/app/admin/_data/dummy.js. stageIndex is the 0-based position
// of the applicant within this array.
export const ONBOARDING_STAGES = [
  "Application",
  "Referencing",
  "Right to Rent",
  "Guarantor",
  "Deposit",
  "Agreement",
  "Move-in",
];

const employmentSchema = new mongoose.Schema(
  {
    employer: { type: String, trim: true, default: "" },
    jobTitle: { type: String, trim: true, default: "" },
    type: { type: String, trim: true, default: "" },
    annualIncome: { type: Number, default: 0 },
    startDate: { type: String, default: "" },
  },
  { _id: false }
);

const rightToRentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "verified", "failed", "n/a"],
      default: "pending",
    },
    docType: { type: String, trim: true, default: "" },
    docNumber: { type: String, trim: true, default: "" },
    expiry: { type: String, default: "" },
    shareCode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const referenceStatus = {
  type: String,
  enum: ["pending", "passed", "failed", "n/a"],
  default: "pending",
};

const referencesSchema = new mongoose.Schema(
  {
    previousLandlord: referenceStatus,
    employer: referenceStatus,
    credit: referenceStatus,
  },
  { _id: false }
);

const guarantorSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    relationship: { type: String, trim: true, default: "" },
    annualIncome: { type: Number, default: 0 },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["not_required", "pending", "approved", "failed"],
      default: "not_required",
    },
  },
  { _id: false }
);

const tenancySchema = new mongoose.Schema(
  {
    // Optional structured references so a completed onboarding can create a
    // Tenancy that's linked to the real property/room (enables room-scoped
    // features like room-specific welcome packs). The name strings below stay
    // for display and for onboardings created without a picked room.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    property: { type: String, trim: true, default: "—" },
    room: { type: String, trim: true, default: "—" },
    rent: { type: Number, default: 0 },
    frequency: { type: String, default: "monthly" },
    deposit: { type: Number, default: 0 },
    startDate: { type: String, default: "" },
    termMonths: { type: Number, default: 12 },
  },
  { _id: false }
);

const depositSchemeSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["DPS", "MyDeposits", "TDS"],
      default: "DPS",
    },
    status: {
      type: String,
      enum: ["not_started", "pending", "protected", "failed"],
      default: "not_started",
    },
    ref: { type: String, trim: true, default: "—" },
  },
  { _id: false }
);

// Documents keep their own _id so the client can target one for verify/delete.
const documentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    type: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    url: { type: String, trim: true, default: "" },
    publicId: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

const onboardingSchema = new mongoose.Schema(
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

    // Optional link back to the lead this applicant was converted from.
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },

    // ============================
    // Applicant
    // ============================
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    dob: { type: String, default: "" },
    nationality: { type: String, trim: true, default: "" },
    currentAddress: { type: String, trim: true, default: "" },

    // Pipeline position — index into ONBOARDING_STAGES.
    stageIndex: {
      type: Number,
      default: 0,
      min: 0,
      max: ONBOARDING_STAGES.length - 1,
    },

    holdingDeposit: { type: Number, default: 0 },

    // ============================
    // Onboarding detail
    // ============================
    employment: { type: employmentSchema, default: () => ({}) },
    rightToRent: { type: rightToRentSchema, default: () => ({}) },
    references: { type: referencesSchema, default: () => ({}) },
    guarantor: { type: guarantorSchema, default: () => ({}) },
    tenancy: { type: tenancySchema, default: () => ({}) },
    depositScheme: { type: depositSchemeSchema, default: () => ({}) },
    documents: { type: [documentSchema], default: [] },

    // ============================
    // Completion — set when the operator finalises "Move-in". Once completed we
    // create a Tenancy (linked below) so the tenant can access their room.
    // ============================
    completedAt: { type: Date, default: null },
    tenancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      default: null,
    },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Onboarding", onboardingSchema);
