// routes/onboarding.route.js
import express from "express";
import {
  createOnboarding,
  getOnboardings,
  getOnboardingById,
  updateOnboarding,
  updateOnboardingStage,
  completeOnboarding,
  deleteOnboarding,
  getOnboardingStats,
  addOnboardingDocument,
  verifyOnboardingDocument,
  deleteOnboardingDocument,
  getOnboardingRequests,
  acceptOnboardingRequest,
  getMyOnboarding,
  addMyOnboardingDocument,
  deleteMyOnboardingDocument,
  cancelOnboarding,
} from "../controllers/onboarding.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Onboarding statistics (summary cards)
router.get("/stats", getOnboardingStats);

// Website requests inbox + accept flow (admin), and the tenant's own view.
// These fixed paths MUST be declared before "/:id" so they aren't captured by it.
router.get("/requests", getOnboardingRequests);
router.get("/me", getMyOnboarding);
router.post("/accept-request", acceptOnboardingRequest);

// Tenant-owned document actions on their own onboarding (authorized by email,
// not org membership). 3-segment paths, so they don't collide with "/:id".
router.post("/me/:id/documents", addMyOnboardingDocument);
router.delete("/me/:id/documents/:docId", deleteMyOnboardingDocument);

// CRUD operations
router.post("/", createOnboarding);
router.get("/", getOnboardings);
router.get("/:id", getOnboardingById);
router.put("/:id", updateOnboarding);
router.delete("/:id", deleteOnboarding);

// Advance / set the onboarding stage (stepper)
router.patch("/:id/stage", updateOnboardingStage);

// Complete onboarding (Move-in) → creates the tenancy, unlocks the tenant's room
router.patch("/:id/complete", completeOnboarding);

// Cancel an onboarding (soft delete + revert lead + disconnect tenant)
router.patch("/:id/cancel", cancelOnboarding);

// Documents — upload, verify/reject, remove
router.post("/:id/documents", addOnboardingDocument);
router.patch("/:id/documents/:docId/verify", verifyOnboardingDocument);
router.delete("/:id/documents/:docId", deleteOnboardingDocument);

export default router;
