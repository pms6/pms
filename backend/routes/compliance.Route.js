import express from "express";
import {
  getCompliances,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  sendComplianceReminders,
} from "../controllers/compliance.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// The whole compliance register is staff-only.
// Compliance documents are internal to the operator and are never shared with
// tenants, so there is no tenant-facing route here at all. `protect` on its own
// resolves an organizationId for tenants too, which is why staffOnly is needed.
router.use(protect, staffOnly);

router.get("/", getCompliances);
router.post("/", createCompliance);
router.put("/:id", updateCompliance);
router.delete("/:id", deleteCompliance);

// Manual "send now" trigger for the expiry reminders the daily 8am cron job
// otherwise fires. Same de-duplication applies, so pressing it twice in one
// reminder window sends one email, not two.
router.post("/send-reminders", sendComplianceReminders);

export default router;