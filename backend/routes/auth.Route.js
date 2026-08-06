import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  resendOtp,
  verifyOtp,
  login,
  logout,
  getMe,
  updateProfile,
  updateOrganization,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controllers/auth.Controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// The per-user cooldown in the controller stops one account being spammed;
// this stops one caller working through many accounts. Deliberately tighter
// than the app-wide limiter in index.js.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

router.post("/register", otpLimiter, register);
router.post("/resend-otp", otpLimiter, resendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/logout", logout);

// Password reset — request a code, optionally check it, then set a new password
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Protected route to fetch current active profile details
router.get("/me", protect, getMe);

// Protected route to complete/update the tenant personal profile
router.patch("/profile", protect, updateProfile);

// In routes/authRoutes.js
router.patch("/organization", protect, updateOrganization);

export default router;
