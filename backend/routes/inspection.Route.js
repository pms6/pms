// routes/inspectionRoutes.js
import express from "express";
import {
  createInspection,
  getInspections,
  getInspection,
  updateInspection,
  deleteInspection,
  completeInspection,
} from "../controllers/inspection.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// ========================
// INSPECTION ROUTES
// ========================
// staffOnly as well as protect: `protect` resolves an organizationId for a
// TENANT account too, so without it a tenant could read the whole register.
router.use(protect, staffOnly);

// Get all inspections for the user's organization
router.get("/", getInspections);

// Get single inspection
router.get("/:id", getInspection);

// Create new inspection
router.post("/", createInspection);

// Update inspection
router.put("/:id", updateInspection);

// Mark inspection as completed
router.patch("/:id/complete", completeInspection);

// Soft delete inspection
router.delete("/:id", deleteInspection);

export default router;