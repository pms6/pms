"use client";

// The create / edit task form.
//
// Lifted out of the task board and stripped of its modal chrome so it can be a
// page of its own: assigning work means a title, a description, several
// assignees, dates and attachments, which is more than a dialog over a table
// wants to hold. The board now links to /admin/tasks/new and
// /admin/tasks/<id>/edit instead of opening it in place.

import { useState } from "react";
import { X, Loader2, Paperclip } from "lucide-react";
import { uploadFileToCloudinary } from "../../utils/uploadToCloudinary";
import {
  TASK_PRIORITIES,
  SETTABLE_STATUSES,
  toInputDateTime,
  displayName,
  FIELD,
  LABEL,
} from "../../Shared/tasks";

export default function TaskForm({ members, initial, onCancel, onSave }) {
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
    <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-7 max-w-3xl">
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

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
        </div>
      </form>
    </div>
  );
}
