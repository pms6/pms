import mongoose from "mongoose";

// Maintenance request priority / status vocabularies — MUST stay in sync with
// PRIORITY_TONE / STATUS_TONE / STATUSES in
// frontend/src/app/admin/maintenance/page.js.
export const MAINTENANCE_PRIORITIES = ["urgent", "high", "med", "low"];
export const MAINTENANCE_STATUSES = ["open", "assigned", "in_progress", "closed"];

const maintenanceSchema = new mongoose.Schema(
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

    // Human-friendly reference, e.g. "MR-1042". Generated on create.
    ref: { type: String, trim: true, index: true },

    // ============================
    // Request detail
    // ============================
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "General" },

    // Optional links back to source records; denormalised names keep the card
    // list cheap to render.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    property: { type: String, trim: true, default: "" },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    room: { type: String, trim: true, default: "" },

    reportedBy: { type: String, trim: true, default: "" },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplier: { type: String, trim: true, default: "" },

    priority: {
      type: String,
      enum: MAINTENANCE_PRIORITIES,
      default: "med",
    },
    status: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      default: "open",
    },

    // null until quoted / invoiced.
    cost: { type: Number, default: null },

    date: { type: Date, default: Date.now },

    image: { type: String, trim: true, default: "" },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

maintenanceSchema.index({ organizationId: 1, isDeleted: 1 });

export default mongoose.model("Maintenance", maintenanceSchema);
