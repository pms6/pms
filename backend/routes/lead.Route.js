// routes/lead.route.js
import express from "express";
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getLeadStats,
} from "../controllers/lead.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Lead statistics
router.get("/stats", getLeadStats);

// CRUD operations
router.post("/", createLead);
router.get("/", getLeads);
router.get("/:id", getLeadById);
router.put("/:id", updateLead);
router.delete("/:id", deleteLead);

// Special operations
router.patch("/:id/status", updateLeadStatus);

export default router;
