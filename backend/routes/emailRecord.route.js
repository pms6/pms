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
import { protect, staffOnly } from "../middleware/auth.js";
import { getEmailMailbox, testEmailMailbox, saveEmailMailbox, disconnectEmailMailbox } from "../controllers/emailMailbox.controller.js";

const router = express.Router();

// Staff only: protect() also resolves an organizationId for tenant accounts,
// which would otherwise let a tenant read the whole organisation's records.
router.use(protect, staffOnly);

// Fixed paths before "/:id" so they are not read as an id.
router.get("/options", getEmailRecordOptions);
router.get("/mailbox", getEmailMailbox);
router.post("/mailbox/test", testEmailMailbox);
router.put("/mailbox", saveEmailMailbox);
router.delete("/mailbox", disconnectEmailMailbox);
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
