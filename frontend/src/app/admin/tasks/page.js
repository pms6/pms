"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  X,
  Loader2,
  Search,
  Trash2,
  Edit2,
  Eye,
  ListChecks,
  Circle,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Users,
  Paperclip,
  History,
  Ban,
} from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import api from "../../api/api";
import { uploadFileToCloudinary } from "../../utils/uploadToCloudinary";
import TaskDetail from "../../Shared/TaskDetail";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  SETTABLE_STATUSES,
  PRIORITY_TONE,
  STATUS_TONE,
  PRIORITY_DOT,
  fmtDateTime,
  toInputDateTime,
  displayName,
  dueLabel,
  FIELD,
  LABEL,
} from "../../Shared/tasks";

const STATUS_META = {
  "Not Started": { icon: Circle, tone: "text-slate-500 bg-slate-100" },
  "In Progress": { icon: PlayCircle, tone: "text-blue-700 bg-blue-100" },
  Done: { icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
  Cancelled: { icon: Ban, tone: "text-gray-500 bg-gray-100" },
  Overdue: { icon: AlertTriangle, tone: "text-red-700 bg-red-100" },
};

function Kpi({ icon: Icon, label, value, tone = "light" }) {
  const wrap = {
    navy: "bg-[#0F253B] text-white",
    orange: "bg-gradient-to-br from-[#F47C3C] to-[#e0651f] text-white",
    light: "bg-white border border-gray-100 text-[#0F253B]",
  }[tone];
  const iconWrap = tone === "light" ? "bg-orange-50 text-[#F47C3C]" : "bg-white/15 text-white";
  const subC = tone === "light" ? "text-gray-400" : "text-white/70";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${wrap}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconWrap}`}>
        <Icon size={22} />
      </div>
      <p className="text-2xl font-bold mt-4">{value}</p>
      <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${subC}`}>{label}</p>
    </div>
  );
}

/**
 * Create / edit a task. Only ever rendered in the admin area — assignment is
 * an admin-only action and the backend enforces the same rule.
 */
function TaskModal({ members, initial, onClose, onSave }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    assignees: (initial?.assignees || []).map((a) => String(a.userId)),
    priority: initial?.priority || "Medium",
    status:
      initial?.status === "Overdue"
        ? "In Progress"
        : initial?.status === "Completed"
          ? "Done"
          : initial?.status || "Not Started",
    startDate: toInputDateTime(initial?.startDate) || toInputDateTime(new Date()),
    dueDate: toInputDateTime(initial?.dueDate),
    adminRemarks: initial?.adminRemarks || "",
  });
  // Attachments already saved on the task, kept so an edit does not drop them.
  const [existing, setExisting] = useState(initial?.attachments || []);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleAssignee = (userId) =>
    setForm((f) => ({
      ...f,
      assignees: f.assignees.includes(userId)
        ? f.assignees.filter((id) => id !== userId)
        : [...f.assignees, userId],
    }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Task title is required.");
    if (!form.description.trim()) return setError("Task description is required.");
    if (form.assignees.length === 0) return setError("Assign the task to at least one team member.");
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      return setError("The due date/time cannot be before the start date/time.");
    }

    setSaving(true);
    setError("");
    try {
      let uploaded = [];
      if (files.length) {
        setUploading(true);
        uploaded = await Promise.all(
          files.map(async (f) => {
            const up = await uploadFileToCloudinary(f);
            return { name: up.name || f.name, url: up.url, publicId: up.publicId || "" };
          })
        );
        setUploading(false);
      }
      await onSave({ ...form, attachments: [...existing, ...uploaded] }, initial?._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save the task.");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">
            {initial ? "Edit Task" : "Create & Assign Task"}
          </h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Task title</label>
            <input
              type="text"
              className={FIELD}
              placeholder="e.g. Fix Property Search Bug"
              value={form.title}
              onChange={set("title")}
              required
            />
          </div>

          <div>
            <label className={LABEL}>Detailed description</label>
            <textarea
              rows={4}
              className={FIELD}
              placeholder="What needs doing, and what does done look like?"
              value={form.description}
              onChange={set("description")}
              required
            />
          </div>

          {/* Assignment */}
          <div>
            <label className={LABEL}>
              Assign to team member{form.assignees.length > 1 ? "s" : ""}
              <span className="text-gray-300 normal-case tracking-normal"> (one or more)</span>
            </label>
            {members.length === 0 ? (
              <p className="text-xs font-medium text-gray-400 bg-gray-50 border border-gray-100 rounded-xl p-3">
                No active team members yet. Invite someone from the Team section first.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                {members.map((m) => {
                  const id = String(m.userId);
                  const on = form.assignees.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => toggleAssignee(id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        on
                          ? "border-[#F47C3C] bg-orange-50 ring-1 ring-orange-100"
                          : "border-gray-100 bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          on ? "bg-[#F47C3C] text-white" : "bg-white text-[#0F253B]"
                        }`}
                      >
                        {displayName(m.email).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-[#0F253B] truncate">{m.email}</span>
                        <span className="block text-[10px] font-bold text-gray-400">{m.role}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={LABEL}>Priority</label>
              <select className={FIELD} value={form.priority} onChange={set("priority")}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Status</label>
              <select className={FIELD} value={form.status} onChange={set("status")}>
                {SETTABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Start date & time</label>
              <input
                type="datetime-local"
                className={FIELD}
                value={form.startDate}
                onChange={set("startDate")}
              />
            </div>
            <div>
              <label className={LABEL}>Due date & time</label>
              <input
                type="datetime-local"
                className={FIELD}
                value={form.dueDate}
                min={form.startDate || undefined}
                onChange={set("dueDate")}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>
              Remarks / instructions{" "}
              <span className="text-gray-300 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              className={FIELD}
              placeholder="Anything the assignee should know before starting."
              value={form.adminRemarks}
              onChange={set("adminRemarks")}
            />
          </div>

          <div>
            <label className={LABEL}>
              Attachments <span className="text-gray-300 normal-case tracking-normal">(optional)</span>
            </label>
            <div className="relative border border-dashed border-gray-200 bg-gray-50 rounded-xl p-3 text-center text-xs font-bold text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
              <input
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <span className="truncate block">
                {files.length
                  ? `${files.length} new file${files.length === 1 ? "" : "s"} selected`
                  : "Choose files…"}
              </span>
            </div>
            {existing.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {existing.map((a) => (
                  <span
                    key={a._id || a.url}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px] font-bold text-[#0F253B]"
                  >
                    <Paperclip size={11} className="text-[#F47C3C]" />
                    <span className="truncate max-w-[10rem]">{a.name || "Attachment"}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setExisting((list) =>
                          list.filter((x) => (x._id || x.url) !== (a._id || a.url))
                        )
                      }
                      className="text-gray-300 hover:text-red-500"
                      title="Remove"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {uploading
              ? "Uploading attachments…"
              : saving
                ? "Saving…"
                : initial
                  ? "Save changes"
                  : "Create & assign"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Lightweight reschedule dialog (date/time + optional note). */
function RescheduleModal({ task, onClose, onSave }) {
  const [startDate, setStartDate] = useState(toInputDateTime(task?.startDate));
  const [dueDate, setDueDate] = useState(toInputDateTime(task?.dueDate));
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (startDate && dueDate && dueDate < startDate) {
      return setError("The due date/time cannot be before the start date/time.");
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        startDate: startDate || null,
        dueDate: dueDate || null,
        remark: remark.trim() || undefined,
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to reschedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#0F253B]">Reschedule task</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs font-medium text-gray-500 mb-4 truncate">{task?.title}</p>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={LABEL}>Start date & time</label>
            <input
              type="datetime-local"
              className={FIELD}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Due date & time</label>
            <input
              type="datetime-local"
              className={FIELD}
              value={dueDate}
              min={startDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>
              Note <span className="text-gray-300 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              className={FIELD}
              placeholder="Why is this being moved?"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Saving…" : "Reschedule"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [dash, setDash] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [q, setQ] = useState("");

  const [modal, setModal] = useState({ open: false, initial: null });
  const [reschedule, setReschedule] = useState({ open: false, task: null });
  const [detailId, setDetailId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (memberFilter) params.assignee = memberFilter;
      if (q.trim()) params.search = q.trim();

      const [listRes, statsRes, membersRes] = await Promise.all([
        api.get("/tasks", { params }),
        api.get("/tasks/stats"),
        api.get("/tasks/assignable-members"),
      ]);
      setTasks(listRes.data?.data || []);
      setDash(statsRes.data || null);
      setMembers(membersRes.data?.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, memberFilter, q]);

  useEffect(() => {
    (async () => {
      await loadData();
    })();
  }, [loadData]);

  const saveTask = async (payload, id) => {
    if (id) await api.put(`/tasks/${id}`, payload);
    else await api.post("/tasks", payload);
    setModal({ open: false, initial: null });
    await loadData();
  };

  const saveReschedule = async (payload) => {
    await api.patch(`/tasks/${reschedule.task._id}/reschedule`, payload);
    setReschedule({ open: false, task: null });
    await loadData();
  };

  const removeTask = async (task) => {
    if (!confirm(`Delete "${task.title}"? This cannot be undone from the UI.`)) return;
    try {
      await api.delete(`/tasks/${task._id}`);
      if (detailId === task._id) setDetailId(null);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete the task.");
    }
  };

  const stats = dash?.stats;
  const detail = tasks.find((t) => t._id === detailId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Task Management"
        subtitle="Assign work to your team, track progress and monitor deadlines"
        action={
          <button
            onClick={() => setModal({ open: true, initial: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> New Task
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Kpi icon={ListChecks} label="Total tasks" value={loading ? "—" : stats?.total ?? 0} tone="navy" />
        <Kpi icon={Circle} label="Not started" value={loading ? "—" : stats?.byStatus?.["Not Started"] ?? 0} />
        <Kpi icon={PlayCircle} label="In progress" value={loading ? "—" : stats?.byStatus?.["In Progress"] ?? 0} />
        <Kpi icon={CheckCircle2} label="Done" value={loading ? "—" : stats?.byStatus?.Done ?? 0} />
        <Kpi icon={Ban} label="Cancelled" value={loading ? "—" : stats?.byStatus?.Cancelled ?? 0} />
        <Kpi icon={AlertTriangle} label="Overdue" value={loading ? "—" : stats?.byStatus?.Overdue ?? 0} tone="orange" />
      </div>

      {/* Completion + priority + members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overall completion</p>
          <p className="text-4xl font-bold text-[#0F253B] mt-2">{stats?.completionRate ?? 0}%</p>
          <div className="mt-3 h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#F47C3C] rounded-full transition-all"
              style={{ width: `${stats?.completionRate ?? 0}%` }}
            />
          </div>
          <p className="text-[11px] font-medium text-gray-400 mt-2">
            {stats?.byStatus?.Done ?? 0} of {stats?.total ?? 0} tasks done
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Tasks by priority</p>
          <div className="space-y-2">
            {TASK_PRIORITIES.map((p) => {
              const n = stats?.byPriority?.[p] ?? 0;
              const pct = stats?.total ? Math.round((n / stats.total) * 100) : 0;
              return (
                <div key={p} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[p]}`} />
                  <span className="text-xs font-bold text-[#0F253B] w-16">{p}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${PRIORITY_DOT[p]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-400 w-6 text-right">{n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
            <Users size={12} className="text-[#F47C3C]" /> Tasks by team member
          </p>
          {!stats?.byMember?.length ? (
            <p className="text-xs font-medium text-gray-400">No tasks assigned yet.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {stats.byMember.map((m) => (
                <button
                  key={m.userId}
                  onClick={() => setMemberFilter(memberFilter === m.userId ? "" : m.userId)}
                  className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg transition-all ${
                    memberFilter === m.userId ? "bg-orange-50 ring-1 ring-orange-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-[#0F253B] truncate">
                      {displayName(m.email)}
                    </span>
                    <span className="block text-[10px] font-bold text-gray-400">{m.role}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {m.Overdue > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                        {m.Overdue}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      {m.Done ?? 0}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                      {m.total}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
            <CalendarClock size={12} className="text-[#F47C3C]" /> Upcoming deadlines
          </p>
          {!dash?.upcoming?.length ? (
            <p className="text-xs font-medium text-gray-400">Nothing due in the next 14 days.</p>
          ) : (
            <div className="space-y-2">
              {dash.upcoming.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setDetailId(t._id)}
                  className="w-full flex items-center gap-3 text-left px-2 py-2 rounded-lg hover:bg-gray-50 transition-all"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-[#0F253B] truncate">{t.title}</span>
                    <span className="block text-[10px] font-medium text-gray-400 truncate">
                      {(t.assignees || []).map((a) => displayName(a.email)).join(", ")}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-[#F47C3C] shrink-0 text-right">
                    <span className="block">{dueLabel(t)}</span>
                    <span className="block font-medium text-gray-400">{fmtDateTime(t.dueDate)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
            <History size={12} className="text-[#F47C3C]" /> Recently updated
          </p>
          {!dash?.recent?.length ? (
            <p className="text-xs font-medium text-gray-400">No task activity yet.</p>
          ) : (
            <div className="space-y-2">
              {dash.recent.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setDetailId(t._id)}
                  className="w-full flex items-center gap-3 text-left px-2 py-2 rounded-lg hover:bg-gray-50 transition-all"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-[#0F253B] truncate">{t.title}</span>
                    <span className="block text-[10px] font-medium text-gray-400 truncate">
                      {t.lastUpdate?.remark || "No updates yet"}
                    </span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${STATUS_TONE[t.effectiveStatus]}`}
                  >
                    {t.effectiveStatus}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search task title or description…"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All members</option>
          {members.map((m) => (
            <option key={String(m.userId)} value={String(m.userId)}>
              {m.email}
            </option>
          ))}
        </select>
      </div>

      {/* Task table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-gray-400 font-medium">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-500 font-medium">No tasks match this view</p>
            <p className="text-sm text-gray-400 mt-1">
              {stats?.total ? "Try another filter." : "Create your first task to start assigning work."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Task</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned to</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Due</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Updates</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium text-[#0F253B]">
                {tasks.map((t) => (
                  <tr
                    key={t._id}
                    onClick={() => setDetailId(t._id)}
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[t.priority]}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate max-w-xs">{t.title}</p>
                          <p className="text-[11px] text-gray-400 font-normal truncate max-w-xs">
                            {t.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      {(t.assignees || []).map((a) => displayName(a.email)).join(", ") || "—"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${PRIORITY_TONE[t.priority]}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_TONE[t.effectiveStatus]}`}
                      >
                        {t.effectiveStatus}
                      </span>
                    </td>
                    <td className="p-4 text-xs">
                      <span
                        className={
                          t.effectiveStatus === "Overdue" ? "text-red-600 font-bold" : "text-gray-500"
                        }
                      >
                        {fmtDateTime(t.dueDate)}
                      </span>
                      <span className="block text-[10px] text-gray-400">{dueLabel(t)}</span>
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      {/* Updates move the task; comments are the team talking
                          about it. Counted apart so neither hides the other. */}
                      <span className="font-bold">{t.progressCount || 0}</span>
                      {(t.commentCount || 0) > 0 && (
                        <span className="text-gray-400"> · {t.commentCount} comment{t.commentCount === 1 ? "" : "s"}</span>
                      )}
                      {t.lastUpdate && (
                        <span className="block text-[10px] text-gray-400 truncate max-w-[9rem]">
                          {fmtDateTime(t.lastUpdate.createdAt)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailId(t._id);
                          }}
                          className="p-1.5 text-gray-300 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg transition-all"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReschedule({ open: true, task: t });
                          }}
                          className="p-1.5 text-gray-300 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg transition-all"
                          title="Reschedule"
                        >
                          <CalendarClock size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal({ open: true, initial: t });
                          }}
                          className="p-1.5 text-gray-300 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg transition-all"
                          title="Edit or reassign"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTask(t);
                          }}
                          className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <TaskModal
          members={members}
          initial={modal.initial}
          onClose={() => setModal({ open: false, initial: null })}
          onSave={saveTask}
        />
      )}

      {reschedule.open && reschedule.task && (
        <RescheduleModal
          task={reschedule.task}
          onClose={() => setReschedule({ open: false, task: null })}
          onSave={saveReschedule}
        />
      )}

      {detail && (
        <TaskDetail task={detail} onClose={() => setDetailId(null)} onChanged={loadData} />
      )}
    </div>
  );
}