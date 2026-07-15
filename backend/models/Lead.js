import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
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
    // Lead Details
    // ============================
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      enum: ["Rightmove", "Zoopla", "SpareRoom", "OpenRent", "Website", "Referral"],
      default: "Website",
    },

    interestedIn: {
      type: String,
      trim: true,
    },

    // Structured link to what the lead enquired about (set by website
    // enquiries). Used to dedupe a tenant's repeat requests for the same room.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },

    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },

    budget: {
      type: Number,
      default: 0,
    },

    assignedTo: {
      type: String,
      trim: true,
    },

    // Pipeline stage — matches the frontend Kanban columns.
    status: {
      type: String,
      enum: ["new", "qualified", "viewing", "converted", "lost"],
      default: "new",
    },

    notes: String,

    // ============================
    // Soft delete
    // ============================
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

export default mongoose.model("Lead", leadSchema);