import express from "express";
import { register, verifyOtp, login, logout, getMe, updateProfile, updateOrganization } from "../controllers/auth.Controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/logout", logout);

// Protected route to fetch current active profile details
router.get("/me", protect, getMe);

// Protected route to complete/update the tenant personal profile
router.patch("/profile", protect, updateProfile);

// In routes/authRoutes.js
router.patch("/organization", protect, updateOrganization);

export default router;