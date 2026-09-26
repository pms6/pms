// routes/emailRecord.route.js
import express from "express";
import {
  getEmailRecordOptions,
  getEmailRecords,
  createEmailRecord,
  updateEmailRecord,
  deleteEmailRecord,
  addHistoryEntry,
  deleteHistoryEntry,
  resendEmail,
  runEmailReminders,
  fetchInbox,
  getInboxStatus,
} from "../controllers/emailRecord.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Fixed paths before "/:id" so they are not read as an id.
router.get("/options", getEmailRecordOptions);
router.post("/run-reminders", runEmailReminders);
router.post("/fetch-inbox", fetchInbox);
router.get("/inbox-status", getInboxStatus);

router.get("/", getEmailRecords);
router.post("/", createEmailRecord);
router.put("/:id", updateEmailRecord);
router.delete("/:id", deleteEmailRecord);

router.post("/:id/send", resendEmail);
router.post("/:id/history", addHistoryEntry);
router.delete("/:id/history/:entryId", deleteHistoryEntry);

export default router;
