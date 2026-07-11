import mongoose from "mongoose";

// Tenancy (occupancy) lifecycle statuses — MUST stay in sync with
// TENANCY_STATUS in frontend/src/app/admin/_data/dummy.js.
export const TENANCY_STATUS = [
  "Fixed Term",
  "Becoming Periodic",
  "Periodic",
  "Ending",
];

const tenancySchema = new mongoose.Schema(
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

    // Optional links back to the source records. The denormalised string
    // fields below keep the list rendering cheap even when a ref is missing.
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
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },

    // ============================
    // Display fields
    // ============================
    property: { type: String, trim: true, required: true },
    unit: { type: String, trim: true, default: "—" },
    tenant: { type: String, trim: true, required: true },
    tenantEmail: { type: String, trim: true, lowercase: true, default: "" },

    // ============================
    // Tenancy terms
    // ============================
    rent: { type: Number, default: 0 },

    startDate: { type: Date, default: null },
    // A fixed-term tenancy has an end date; a periodic one has a periodic
    // start date instead. Exactly one is typically set.
    fixedTermEnd: { type: Date, default: null },
    periodicStart: { type: Date, default: null },

    // Free-text availability (e.g. "Occupied" or "Available 16 Aug").
    availability: { type: String, trim: true, default: "Occupied" },

    status: {
      type: String,
      enum: TENANCY_STATUS,
      default: "Fixed Term",
    },

    // Whether the tenant has completed onboarding. When false the UI offers to
    // send an onboarding invite.
    onboarded: { type: Boolean, default: false },
    invitedAt: { type: Date, default: null },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

tenancySchema.index({ organizationId: 1, isDeleted: 1 });

export default mongoose.model("Tenancy", tenancySchema);
