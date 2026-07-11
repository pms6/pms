// routes/onboarding.route.js
import express from "express";
import {
  createOnboarding,
  getOnboardings,
  getOnboardingById,
  updateOnboarding,
  updateOnboardingStage,
  deleteOnboarding,
  getOnboardingStats,
  addOnboardingDocument,
  verifyOnboardingDocument,
  deleteOnboardingDocument,
} from "../controllers/onboarding.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Onboarding statistics (summary cards)
router.get("/stats", getOnboardingStats);

// CRUD operations
router.post("/", createOnboarding);
router.get("/", getOnboardings);
router.get("/:id", getOnboardingById);
router.put("/:id", updateOnboarding);
router.delete("/:id", deleteOnboarding);

// Advance / set the onboarding stage (stepper)
router.patch("/:id/stage", updateOnboardingStage);

// Documents — upload, verify/reject, remove
router.post("/:id/documents", addOnboardingDocument);
router.patch("/:id/documents/:docId/verify", verifyOnboardingDocument);
router.delete("/:id/documents/:docId", deleteOnboardingDocument);

export default router;
