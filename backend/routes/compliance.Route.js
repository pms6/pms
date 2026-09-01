import express from "express";
import {
  getCompliances,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  getMyCompliance,
  sendComplianceReminders,
} from "../controllers/compliance.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Tenant's own property compliance — must be declared before "/" for clarity.
// This is the one route a tenant may reach; it scopes itself to their own
// property, so it takes `protect` alone.
router.get("/my", getMyCompliance);

// Everything below is the organization's whole compliance register, so it is
// staff-only. `protect` on its own resolves an organizationId for tenants too,
// which would otherwise hand a tenant every property's certificates — and, now
// that these routes exist, the ability to edit and delete them.
router.get("/", staffOnly, getCompliances);
router.post("/", staffOnly, createCompliance);
router.put("/:id", staffOnly, updateCompliance);
router.delete("/:id", staffOnly, deleteCompliance);

// Manual "send now" trigger for the expiry reminders the daily 8am cron job
// otherwise fires. Same de-duplication applies, so pressing it twice in one
// reminder window sends one email, not two.
router.post("/send-reminders", staffOnly, sendComplianceReminders);

export default router;