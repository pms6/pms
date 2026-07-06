// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true },
    password: String,

    isVerified: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["Pending", "Tenant", "Organization"],
      default: "Pending",
    },

    otp: String,
    otpExpire: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);