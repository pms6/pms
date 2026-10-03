// routes/tenantMessage.route.js
import express from "express";
import {
  getMyThread,
  getMyUnreadCount,
  sendMyMessage,
  listThreads,
  getStaffUnreadCount,
  getThread,
  sendThreadMessage,
} from "../controllers/tenantMessage.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// A tenant's own conversation. The controller checks the Tenant role and
// scopes everything to the tenant's own email.
router.get("/my", getMyThread);
router.get("/my/unread", getMyUnreadCount);
router.post("/my", sendMyMessage);

// Every conversation in the organization — staff only. `protect` resolves an
// organizationId for a TENANT account too, so without staffOnly a tenant could
// read their housemates' conversations.
router.use(staffOnly);

router.get("/unread", getStaffUnreadCount);
router.get("/threads", listThreads);
router.get("/threads/:email", getThread);
router.post("/threads/:email", sendThreadMessage);

export default router;
