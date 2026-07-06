// models/Organization.js
import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    type: {
      type: String,
      enum: ["AGENCY", "LANDLORD"],
    },

    businessType: {
      type: String,
      enum: ["BUSINESS", "INDIVIDUAL"],
    },

    name: String,
    legalName: String,
    phone: String,
    address: String,
    logo: String,

    units: Number,
    planType: {
      type: String,
      enum: ["MONTHLY", "ANNUAL"],
    },

    fastTrack: Boolean,
  },
  { timestamps: true }
);

export default mongoose.model("Organization", organizationSchema);