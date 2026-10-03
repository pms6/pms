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
  declineOnboardingRequest,
  getMyOnboarding,
  addMyOnboardingDocument,
  deleteMyOnboardingDocument,
  cancelOnboarding,
} from "../controllers/onboarding.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// The tenant's own onboarding, and the documents they upload to it (authorized
// by email, not org membership). These fixed paths MUST be declared before
// "/:id" so they aren't captured by it.
router.get("/me", getMyOnboarding);
router.post("/me/:id/documents", addMyOnboardingDocument);
router.delete("/me/:id/documents/:docId", deleteMyOnboardingDocument);

// Everything below works on every applicant's onboarding file — ID documents,
// references, contact details — so it is staff-only. `protect` resolves an
// organizationId for a TENANT account too.
router.use(staffOnly);

// Onboarding statistics (summary cards)
router.get("/stats", getOnboardingStats);

// Website requests inbox + accept flow (admin).
router.get("/requests", getOnboardingRequests);
router.post("/accept-request", acceptOnboardingRequest);
router.post("/decline-request", declineOnboardingRequest);

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
