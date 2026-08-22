import express from "express";
import {
  getCompliances,
  createCompliance,
  getMyCompliance,
  sendComplianceReminders,
} from "../controllers/compliance.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Tenant's own property compliance — must be declared before "/" for clarity.
router.get("/my", getMyCompliance);

router.get("/", getCompliances);
router.post("/", createCompliance);   // No multer needed anymore

// Manual "send now" trigger for the expiry reminders the daily 8am cron job
// otherwise fires. Same de-duplication applies, so pressing it twice in one
// reminder window sends one email, not two.
router.post("/send-reminders", sendComplianceReminders);

export default router;