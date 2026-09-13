import mongoose from "mongoose";

// In-app notifications — the thing a person sees inside the PMS itself when
// they have not (yet, or ever) read the email about it. One document per
// recipient rather than one shared document with a list of readers, so
// "unread count" and "mark as read" are both a plain query on this user's own
// rows, with no per-viewer state to track inside a shared record.
//
// Task Management is the only feature writing these today (see
// notifyAssignees / notifyCommentRecipients / notifyProgressUpdate in
// task.controller.js), but the shape is deliberately generic — `type` plus a
// free `relatedType`/`relatedId` pair — so another feature can start writing
// its own notifications later without a schema change.
export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_comment",
  "task_update",
];

const notificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Who this notification is FOR. Always a specific person — there is no
    // "broadcast to a role" row, because read state is per person.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, trim: true, required: true },
    message: { type: String, trim: true, default: "" },

    // What this is about. Generic on purpose (see the note above) — Task
    // Management points relatedType at "Task" and relatedId at the task's id.
    relatedType: { type: String, trim: true, default: "" },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Who caused it, so "you" never appears in your own notification list —
    // callers filter the actor out of the recipient list before writing these,
    // but this is kept too for anything that renders "from So-and-so".
    actorEmail: { type: String, trim: true, default: "" },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The bell polls "my unread, newest first" and "all of mine, newest first" —
// both are this one index.
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
