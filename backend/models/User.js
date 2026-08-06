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

    // Email-verification code (sign-up).
    otp: String,
    otpExpire: Date,
    otpSentAt: Date, // drives the resend cooldown
    otpAttempts: { type: Number, default: 0 }, // wrong guesses on the current code

    // Password-reset code — kept separate from the verification code so a
    // pending reset can never be used to verify an account, or vice versa.
    resetOtp: String,
    resetOtpExpire: Date,
    resetOtpSentAt: Date,
    resetOtpAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);