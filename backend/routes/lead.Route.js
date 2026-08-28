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
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Leads are a team-wide pipeline: every staff seat (OWNER, MANAGER, AGENT,
// FINANCE) may add, edit, move and delete one, which is why there is no
// per-role split below. `staffOnly` is what keeps TENANT accounts out — they
// carry an organizationId of their own, so checking for one is not enough.
router.use(protect);
router.use(staffOnly);

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
