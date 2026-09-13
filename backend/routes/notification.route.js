// routes/notification.route.js
import express from "express";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Staff-only, same as presence and screen-monitor — the only thing writing
// these today is Task Management, which is a staff-only feature.
router.use(protect);
router.use(staffOnly);

router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;
