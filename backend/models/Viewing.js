import mongoose from "mongoose";

const viewingSchema = new mongoose.Schema(
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
      required: true,
    },

    // ============================
    // Core Viewing Fields
    // ============================
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    time: {
      type: String, // HH:mm (24h format)
      required: true,
    },

    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property", // Assuming you have a Property model
      required: true,
    },

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },

    agent: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["scheduled", "done", "cancelled"],
      default: "scheduled",
    },

    notes: {
      type: String,
      trim: true,
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying by organization + date
viewingSchema.index({ organizationId: 1, date: 1, time: 1 });
viewingSchema.index({ lead: 1, status: 1 });

export default mongoose.model("Viewing", viewingSchema);