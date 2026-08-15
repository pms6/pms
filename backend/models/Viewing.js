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

    // ============================
    // Reschedule trail
    // ============================
    // One entry per move, oldest first. `date`/`time` above always hold the
    // current slot; this is the record of where it has been.
    rescheduleHistory: [
      {
        fromDate: { type: String, required: true }, // YYYY-MM-DD
        fromTime: { type: String, required: true }, // HH:mm
        toDate: { type: String, required: true },
        toTime: { type: String, required: true },
        reason: { type: String, trim: true, default: "" },
        rescheduledBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    lastRescheduledAt: {
      type: Date,
      default: null,
    },

    // ============================
    // Tenant reschedule request
    // ============================
    // A tenant can propose a new slot but never move the operator's calendar
    // themselves — the operator approves or declines. Empty status = no request
    // outstanding. Only one request is tracked at a time; a new proposal while
    // one is pending replaces it.
    rescheduleRequest: {
      status: {
        type: String,
        enum: ["", "pending", "approved", "declined"],
        default: "",
      },
      requestedDate: { type: String, default: "" }, // YYYY-MM-DD
      requestedTime: { type: String, default: "" }, // HH:mm
      reason: { type: String, trim: true, default: "" },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      requestedAt: { type: Date, default: null },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      respondedAt: { type: Date, default: null },
      responseNote: { type: String, trim: true, default: "" },
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