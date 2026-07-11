// models/Inspection.js
import mongoose from "mongoose";

const inspectionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      index: true,
    },

    // Core Inspection Fields
    title: { type: String, required: true },           // e.g., "Annual Fire Safety Check"
    date: { type: Date, required: true, index: true }, // Actual inspection date

    type: {
      type: String,
      enum: ["ROUTINE", "MAINTENANCE", "MOVE_IN", "MOVE_OUT", "SAFETY", "COMPLIANCE", "OTHER"],
      required: true,
    },

    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "OVERDUE"],
      default: "SCHEDULED",
    },

    notes: String,

    findings: [
      {
        item: String,
        status: { type: String, enum: ["PASS", "FAIL", "NEEDS_ATTENTION"] },
        comment: String,
      },
    ],

    // Reminder Support
    reminderSent: { type: Boolean, default: false },
    reminderDate: { type: Date }, // Auto-calculated (e.g., 30 days before)

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Inspection", inspectionSchema);