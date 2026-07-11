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
import { protect } from "../middleware/auth.js";

const router = express.Router();

// ========================
// INSPECTION ROUTES
// ========================
router.use(protect);

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