import mongoose from "mongoose";

const ownerSchema = new mongoose.Schema(
  {
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

    name: {
      type: String,
      required: true,
      index: true,
    },

    company: {
      type: Boolean,
      default: false,
    },

    email: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["lead", "in_progress", "live"],
      default: "lead",
    },

    payoutStatus: {
      type: String,
      enum: ["paid", "due", "pending"],
      default: "pending",
    },

    // Property names this owner is associated with (matches the UI picker).
    properties: [String],

    maintenance: {
      type: Number,
      default: 0,
    },

    monthlyIncome: {
      type: Number,
      default: 0,
    },

    bank: {
      account: { type: String, default: "" },
    },

    notes: {
      type: String,
      default: "",
    },

    files: [String],

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Owner", ownerSchema);
