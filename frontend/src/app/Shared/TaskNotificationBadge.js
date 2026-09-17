"use client";

import { Bell } from "lucide-react";
import api from "@/app/api/api";

/* ---------------------------------------------------------------------------
 * Per-task notification badge.
 *
 * The bell lists every notification; this marks WHICH task in a list has news
 * for the signed-in person. Task lists read `unreadNotifications` /
 * `unreadTypes`, which the /tasks endpoints attach for the viewer.
 *
 * Lists and the bell talk through two window events rather than shared state,
 * since the bell lives in the portal header and the lists in the page:
 *   NOTIFICATIONS_ARRIVED — the bell saw new unread rows, so reload the list.
 *   NOTIFICATIONS_READ    — a list cleared a task's rows, so refresh the bell.
 * ------------------------------------------------------------------------- */

export const NOTIFICATIONS_ARRIVED = "pms:notifications-arrived";
export const NOTIFICATIONS_READ = "pms:notifications-read";

const TYPE_LABEL = {
  task_assigned: "Newly assigned",
  task_comment: "New comment",
  task_update: "New update",
};

/**
 * Mark the viewer's notifications for one task read, then tell the bell.
 * Resolves true when there was something to clear.
 */
export const markTaskNotificationsRead = async (task) => {
  if (!task?._id || !task.unreadNotifications) return false;
  try {
    await api.patch(`/notifications/task/${task._id}/read`);
    window.dispatchEvent(new Event(NOTIFICATIONS_READ));
    return true;
  } catch {
    return false; // the badge just stays until the next load
  }
};

/** Clear a task's badge in a list held in state, without refetching it. */
export const clearUnread = (list, taskId) =>
  list.map((t) =>
    t._id === taskId ? { ...t, unreadNotifications: 0, unreadTypes: [] } : t
  );

export default function TaskNotificationBadge({ task }) {
  const count = task?.unreadNotifications || 0;
  if (!count) return null;

  const types = (task.unreadTypes || []).map((t) => TYPE_LABEL[t]).filter(Boolean);
  const label = count === 1 && types[0] ? types[0] : `${count} new`;
  const title = types.length ? types.join(", ") : "New activity";

  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F47C3C] text-white shrink-0 whitespace-nowrap"
    >
      <Bell size={10} className="animate-pulse" />
      {label}
    </span>
  );
}
