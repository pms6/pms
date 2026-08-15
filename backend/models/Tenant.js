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

    // Renting preferences — the same answers the website request form asks for,
    // so a tenant can keep them on their profile rather than retyping each time.
    // Age, gender and work status are already covered by birthdate, gender and
    // occupationType above.
    nationality: String,
    smoking: {
      type: String,
      enum: ["", "YES", "NO"],
      default: "",
    },
    occupancy: {
      type: String,
      enum: ["", "SINGLE", "COUPLE"],
      default: "",
    },
    pet: {
      type: String,
      enum: ["", "YES", "NO"],
      default: "",
    },
    minimumStayMonths: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Tenant", tenantSchema);