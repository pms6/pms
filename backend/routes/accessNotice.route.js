// routes/accessNotice.route.js
import express from "express";
import {
  listNotices,
  getNotice,
  createNotices,
  resendNotice,
  cancelNotice,
  getMyNotices,
  getMyPendingCount,
  acknowledgeNotice,
} from "../controllers/accessNotice.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// A tenant's own notices. The controller checks the Tenant role and scopes to
// the tenant's own email. Declared before "/:id" so "my" isn't read as an id.
router.get("/my", getMyNotices);
router.get("/my/pending", getMyPendingCount);
router.patch("/my/:id/acknowledge", acknowledgeNotice);

// Issuing and managing notices — staff only.
router.use(staffOnly);

router.get("/", listNotices);
router.post("/", createNotices);
router.get("/:id", getNotice);
router.post("/:id/resend", resendNotice);
router.patch("/:id/cancel", cancelNotice);

export default router;
