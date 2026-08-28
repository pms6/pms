"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, ListChecks, Circle, PlayCircle, CheckCircle2, AlertTriangle,
  CalendarClock, Paperclip, MessageSquare, UserRound, Users,
} from "lucide-react";
import { PageHeader } from "./ui";
import api from "@/app/api/api";
import TaskDetail from "./TaskDetail";
import {
  TASK_PRIORITIES, PRIORITY_TONE, STATUS_TONE, PRIORITY_DOT,
  fmtDate, fmtDateTime, displayName, dueLabel,
} from "./tasks";

// Keys are matched against a task's effectiveStatus, so the completed tab is
// keyed "Done" — the value the backend actually derives. Keyed "Completed" it
// matched nothing and the tab always read empty.
const TABS = [
  { key: "all", label: "All", icon: ListChecks },
  { key: "Not Started", label: "Not started", icon: Circle },
  { key: "In Progress", label: "In progress", icon: PlayCircle },
  { key: "Overdue", label: "Overdue", icon: AlertTriangle },
  { key: "Done", label: "Completed", icon: CheckCircle2 },
];

/**
 * Tasks — the team member's view of the work.
 *
 * Two scopes, on one screen:
 *   "mine" → GET /tasks/my, only tasks whose assignees include the signed-in
 *            user. These are the ones they can actually move.
 *   "team" → GET /tasks, every task in the organization, so anybody on the team
 *            can open a colleague's task, read its full history and comment.
 *
 * There is deliberately no create, assign or edit control here at any scope —
 * assignment is the owner's alone. The only write available is via TaskDetail,
 * which posts to /tasks/:id/progress and cannot touch the assignee list.
 */
export default function MyTasks({ portalLabel = "your" }) {
  const [scope, setScope] = useState("mine");
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const [tab, setTab] = useState("all");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const team = scope === "team";

  // No setState before the first await — see the note in admin/tasks/page.js.
  const loadData = useCallback(async () => {
    try {
      const { data } = await api.get(scope === "team" ? "/tasks" : "/tasks/my");
      setTasks(data?.data || []);
      setStats(data?.stats || { total: 0 });
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (scope === "team" ? "Failed to load team tasks." : "Failed to load your tasks.")
      );
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    (async () => { await loadData(); })();
  }, [loadData]);

  const needle = q.trim().toLowerCase();
  const list = tasks.filter((t) => {
    if (tab !== "all" && t.effectiveStatus !== tab) return false;
    if (priority && t.priority !== priority) return false;
    if (!needle) return true;
    return (
      t.title?.toLowerCase().includes(needle) ||
      t.description?.toLowerCase().includes(needle)
    );
  });

  const detail = tasks.find((t) => t._id === detailId);
  const counts = { ...stats, all: stats.total };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        subtitle={
          team
            ? "Every task across the team — open any one to read its history and comment"
            : "Work assigned to you — update progress and report back to the admin"
        }
      />

      {/* Scope. Members can always read the whole team's work; what changes
          between scopes is only what is listed, never what they may do. */}
      <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit">
        {[
          { key: "mine", label: "My tasks", icon: UserRound },
          { key: "team", label: "All team tasks", icon: Users },
        ].map((s) => {
          const active = scope === s.key;
          return (
            <button
              key={s.key}
              onClick={() => {
                setScope(s.key);
                setTab("all");
                setDetailId(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active ? "bg-[#0F253B] text-white" : "text-gray-400 hover:text-[#0F253B]"
              }`}
            >
              <s.icon size={14} className={active ? "text-[#F47C3C]" : ""} />
              {s.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-2xl p-4 text-left transition-all border ${
                active
                  ? "bg-[#0F253B] text-white border-[#0F253B]"
                  : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <t.icon size={18} className={active ? "text-[#F47C3C]" : "text-gray-300"} />
              <p className={`text-xl font-bold mt-2 ${active ? "text-white" : "text-[#0F253B]"}`}>
                {loading ? "—" : counts[t.key] ?? 0}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${active ? "text-white/60" : "text-gray-400"}`}>
                {t.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={team ? "Search team tasks…" : "Search your tasks…"}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] sm:w-44"
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Task cards */}
      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 font-medium">
          {team ? "Loading team tasks…" : "Loading your tasks…"}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
          <p className="text-gray-500 font-medium">
            {tasks.length === 0
              ? team
                ? "No tasks on the team yet"
                : "No tasks assigned to you yet"
              : "No tasks match this view"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {tasks.length === 0
              ? "When the admin assigns work it will appear here."
              : "Try another tab, priority or search term."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((t) => (
            <button
              key={t._id}
              onClick={() => setDetailId(t._id)}
              className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${PRIORITY_TONE[t.priority]}`}>
                  {t.priority}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_TONE[t.effectiveStatus]}`}>
                  {t.effectiveStatus}
                </span>
                {team && t.isMine && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0F253B] text-white">
                    Mine
                  </span>
                )}
              </div>

              <h3 className="font-bold text-[#0F253B] mt-3 line-clamp-2">{t.title}</h3>
              <p className="text-xs text-gray-500 font-medium mt-1 line-clamp-3 flex-1">{t.description}</p>

              <div className="mt-4 pt-3 border-t border-gray-50 space-y-1.5">
                {team && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 truncate">
                    <UserRound size={12} className="text-[#F47C3C] shrink-0" />
                    <span className="truncate">
                      {(t.assignees || []).map((a) => displayName(a.email)).join(", ") ||
                        "Unassigned"}
                    </span>
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                  <CalendarClock size={12} className={t.effectiveStatus === "Overdue" ? "text-red-500" : "text-[#F47C3C]"} />
                  {fmtDate(t.dueDate)}
                  <span className={t.effectiveStatus === "Overdue" ? "text-red-600" : "text-gray-400"}>
                    · {dueLabel(t)}
                  </span>
                </p>
                <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                  <span className="flex items-center gap-1">
                    <ListChecks size={11} /> {t.progressCount || 0} update{(t.progressCount || 0) === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} /> {t.commentCount || 0}
                  </span>
                  {t.attachments?.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip size={11} /> {t.attachments.length}
                    </span>
                  )}
                </div>
                {t.lastUpdate && (
                  <p className="text-[10px] text-gray-400 font-medium truncate">
                    Last: {fmtDateTime(t.lastUpdate.createdAt)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <TaskDetail task={detail} onClose={() => setDetailId(null)} onChanged={loadData} />
      )}
    </div>
  );
}
