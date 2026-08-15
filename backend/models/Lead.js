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

    // ============================
    // Applicant details
    // ============================
    // Screening answers collected on the website request form. Optional at the
    // schema level so leads created by an operator on the Leads board (which
    // asks none of this) still save.
    applicant: {
      age: { type: Number, default: null },
      gender: { type: String, trim: true, default: "" },
      smoking: { type: String, enum: ["", "Yes", "No"], default: "" },
      occupancy: { type: String, enum: ["", "Single", "Couple"], default: "" },
      workStatus: { type: String, enum: ["", "Working", "Student"], default: "" },
      minimumStayMonths: { type: Number, default: null },
      nationality: { type: String, trim: true, default: "" },
      moveInDate: { type: String, default: "" }, // YYYY-MM-DD
      pet: { type: String, enum: ["", "Yes", "No"], default: "" },
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

    // Why the lead was lost. Captured when it moves into the "lost" stage and
    // cleared if it moves back out, so a live lead never carries a stale reason.
    lostReason: {
      type: String,
      trim: true,
      default: "",
    },

    lostAt: {
      type: Date,
      default: null,
    },

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