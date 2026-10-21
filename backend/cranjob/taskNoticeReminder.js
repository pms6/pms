import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import { orgTeamUserIds } from "../utils/orgTeam.js";

// Runs every minute. A due date is the precise task deadline; the reminder is
// created once as it enters the 24-hour window and is reset if rescheduled.
export const remindForTaskNotices = async (now = new Date()) => {
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await Task.find({
    isDeleted: false,
    noticeGiven: { $ne: true },
    status: { $nin: ["Done", "Completed", "Cancelled"] },
    dueDate: { $gt: now, $lte: end },
  }).lean();
  let sent = 0;
  for (const task of tasks) {
    const due = new Date(task.dueDate);
    // Claim this due-date reminder first, preventing repeated alerts on the
    // next minute's run. A reschedule clears the claim.
    const claim = await Task.updateOne(
      { _id: task._id, noticeGiven: { $ne: true }, dueDate: due, noticeReminderDueDate: { $ne: due } },
      { $set: { noticeReminderDueDate: due } }
    );
    if (!claim.modifiedCount) continue;
    try {
      const admins = await orgTeamUserIds(task.organizationId, ["OWNER", "ADMIN"]);
      if (admins.length) {
        await Notification.insertMany(admins.map((userId) => ({
          organizationId: task.organizationId,
          userId,
          type: "task_notice_reminder",
          title: "Task notice is still pending",
          message: `Give notice for "${task.title}" — it is due within 24 hours.`,
          relatedType: "Task",
          relatedId: task._id,
        })));
        sent += admins.length;
      }
    } catch (error) {
      // Permit a later retry if notification delivery failed.
      await Task.updateOne({ _id: task._id, noticeReminderDueDate: due }, { $set: { noticeReminderDueDate: null } });
      console.error(`Task notice reminder failed for ${task._id}:`, error.message);
    }
  }
  return { sent, tasks: tasks.length };
};
