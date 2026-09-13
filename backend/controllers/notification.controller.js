// controllers/notification.controller.js
//
// The in-app half of the alerts task.controller.js already emails out. Email
// reaches a person's inbox; this is what they see inside the PMS itself if
// they haven't (or won't) go looking there — a bell with a count, read here.

import mongoose from "mongoose";
import Notification from "../models/Notification.js";

// How many rows the bell shows in one page. It is a dropdown, not a report —
// anything older than this is still reachable by "read" state alone.
const LIST_LIMIT = 30;

// @desc    My notifications, newest first, plus how many are unread
// @route   GET /api/v1/notifications
export const listNotifications = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const filter = { organizationId, userId: req.user._id };

    const [data, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    return res.status(200).json({ success: true, data, unreadCount });
  } catch (error) {
    console.error("List Notifications Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load notifications." });
  }
};

// @desc    Mark one notification read
// @route   PATCH /api/v1/notifications/:id/read
export const markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification id." });
    }

    const row = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Mark Notification Read Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update the notification." });
  }
};

// @desc    Mark every one of mine read — "clear the bell"
// @route   PATCH /api/v1/notifications/read-all
export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return res.status(200).json({ success: true, message: "All notifications marked read." });
  } catch (error) {
    console.error("Mark All Notifications Read Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update notifications." });
  }
};
