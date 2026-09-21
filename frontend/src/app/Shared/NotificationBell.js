"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "react-toastify";
import api from "../api/api";
import { useAuth } from "../Context/AuthContext";
import { getEffectiveRole } from "../utils/roles";
import { NOTIFICATIONS_ARRIVED, NOTIFICATIONS_READ } from "./TaskNotificationBadge";

/* ---------------------------------------------------------------------------
 * The bell every staff portal shows in its header — the in-app half of the
 * alerts Task Management already emails out (see notifyAssignees /
 * notifyCommentRecipients / notifyProgressUpdate in task.controller.js).
 * Email reaches an inbox; this is what a person sees inside the PMS itself if
 * they never open it, or the mail is a day behind.
 *
 * Polls rather than holding a socket open, matching the rest of this app's
 * live indicators (PresenceHeartbeat, LiveLocationBoard, ScreenMonitorToggle
 * all do the same, and the backend's rate limiter is sized around a handful
 * of once-a-minute requests per person) — paused while the tab is hidden.
 * ------------------------------------------------------------------------- */

const POLL_MS = 45 * 1000;

// Where a role's own task list lives — mirrors TASK_PATH_BY_ROLE in
// backend/controllers/task.controller.js, keyed by the frontend's effective
// role instead of the backend's organizationRole string.
const TASK_PATH_BY_ROLE = {
  organization: "/admin/tasks",
  manager: "/manager/tasks",
  agent: "/agent/tasks",
  finance: "/finance/tasks",
  operation: "/operation/tasks",
};

const ago = (d) => {
  if (!d) return "";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const role = getEffectiveRole(user);
  const taskPath = TASK_PATH_BY_ROLE[role] || "/admin/tasks";

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const seenIds = useRef(null); // null until the first load has landed
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const { data } = await api.get("/notifications");
      const rows = data?.data || [];

      // Toast anything that arrived since the last poll — but never on the
      // very first load, or opening the app would toast every unread
      // notification from the last week at once.
      if (seenIds.current) {
        const fresh = rows.filter((n) => !n.read && !seenIds.current.has(n._id));
        for (const n of fresh.slice(0, 3)) {
          toast.info(n.title, { autoClose: 6000 });
        }
        // Let an open task list badge the tasks these are about.
        if (fresh.length) window.dispatchEvent(new Event(NOTIFICATIONS_ARRIVED));
      }
      seenIds.current = new Set(rows.map((n) => n._id));

      setItems(rows);
      setUnreadCount(data?.unreadCount || 0);
    } catch {
      /* a missed poll just shows stale counts until the next one lands */
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    // A task list cleared a task's notifications by opening it — refresh the
    // count now rather than on the next poll.
    window.addEventListener(NOTIFICATIONS_READ, load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(NOTIFICATIONS_READ, load);
    };
  }, [load]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current?.contains(e.target) || bellRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markRead = async (id) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      /* the next poll reconciles it either way */
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.patch("/notifications/read-all");
    } catch {
      /* the next poll reconciles it either way */
    }
  };

  const openNotification = async (n) => {
    setOpen(false);
    if (!n.read) await markRead(n._id);
    // Task Management has no per-task page — the detail opens as a panel over
    // the list — so this is the deepest a click can point: that role's own
    // task list, with ?open= for the list to pick up and open the panel on
    // load (admin/tasks/page.js and Shared/MyTasks.js both read it).
    // Email Records lives in the admin portal only, so its notifications go
    // there for an admin and fall back to the task list for anyone else.
    const target =
      n.relatedType === "EmailRecord" && n.relatedId && role === "organization"
        ? `/admin/email-records?open=${n.relatedId}`
        : n.relatedType === "Task" && n.relatedId
          ? `${taskPath}?open=${n.relatedId}`
          : taskPath;
    router.push(target);
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-[#0F253B] hover:bg-gray-50 transition-all"
        title="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#F47C3C] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-[#0F253B]">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-bold text-[#F47C3C] hover:text-[#e06d30]"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs font-medium text-gray-400">
                Nothing yet — task assignments, comments and updates will show up here.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => openNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-all flex items-start gap-2.5 ${
                    n.read ? "" : "bg-orange-50/40"
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      n.read ? "bg-gray-200" : "bg-[#F47C3C]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-[#0F253B] truncate">
                      {n.title}
                    </span>
                    {n.message && (
                      <span className="block text-[11px] text-gray-500 font-medium line-clamp-2 mt-0.5">
                        {n.message}
                      </span>
                    )}
                    <span className="block text-[10px] text-gray-300 font-bold mt-1">
                      {ago(n.createdAt)}
                    </span>
                  </span>
                  {n.read && <Check size={13} className="text-gray-200 shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
