// models/TenantProfile.js
import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    firstName: String,
    lastName: String,
    birthdate: Date,
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_SAY"],
    },

    profileImage: String,

    about: String,

    occupationType: {
      type: String,
      enum: ["PROFESSIONAL", "STUDENT"],
    },

    jobTitle: String,

    interests: [String],

    budget: Number,
    moveInDate: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Tenant", tenantSchema);