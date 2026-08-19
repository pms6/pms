// models/Inspection.js
import mongoose from "mongoose";

// Photo evidence captured by the inspector. `publicId` is kept so the image can
// be removed from Cloudinary later; `caption` labels what the shot shows
// (e.g. "damp patch — rear bedroom ceiling").
const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    caption: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

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
        // Per-finding evidence, separate from the general `photos` gallery.
        photos: [photoSchema],
      },
    ],

    // General photo evidence for the visit as a whole.
    photos: [photoSchema],

    // Overall verdict recorded when the report is submitted. Blank until then,
    // which is why "" is a valid enum value.
    outcome: {
      type: String,
      enum: ["", "PASS", "ACTION_REQUIRED", "FAIL"],
      default: "",
    },

    // Report submission audit — set by completeInspection, preserved on later
    // edits of the report so the original sign-off is not lost.
    completedAt: { type: Date },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

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