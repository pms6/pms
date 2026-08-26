"use client";

import { useState } from "react";
import {
  X, Paperclip, Send, Loader2, CalendarClock, CalendarDays, UserRound,
  MessageSquare, FileCheck2, History,
} from "lucide-react";
import api from "@/app/api/api";
import { uploadFileToCloudinary } from "@/app/utils/uploadToCloudinary";
import {
  PRIORITY_TONE, STATUS_TONE, SETTABLE_STATUSES,
  fmtDate, fmtDateTime, displayName, dueLabel, FIELD, LABEL,
} from "./tasks";

function Meta({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-bold text-[#0F253B] mt-0.5 flex items-center gap-1.5 break-words">
        {Icon && <Icon size={13} className="text-[#F47C3C] shrink-0" />}
        {value || "—"}
      </p>
    </div>
  );
}

function AttachmentList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((a) => (
        <a
          key={a._id || a.url}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-bold text-[#0F253B] transition-all max-w-full"
        >
          <Paperclip size={12} className="text-[#F47C3C] shrink-0" />
          <span className="truncate">{a.name || "Attachment"}</span>
        </a>
      ))}
    </div>
  );
}

/**
 * Full detail of one task, plus the form for appending a progress update.
 *
 * Shared by the admin dashboard and the member "My Tasks" view — the two see
 * exactly the same history, which is the point of the feature. `canUpdate`
 * turns the update form on; nothing here can reassign a task, because the only
 * endpoint it calls is POST /tasks/:id/progress.
 */
export default function TaskDetail({ task, onClose, onChanged, canUpdate = true }) {
  const [status, setStatus] = useState(
    task.status === "Overdue" ? "In Progress" : task.status || "Not Started"
  );
  const [remark, setRemark] = useState("");
  const [isReport, setIsReport] = useState(false);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Newest first, so the most recent update is what you read first.
  const history = [...(task.progress || [])].reverse();

  const submit = async (e) => {
    e.preventDefault();
    if (!remark.trim() && files.length === 0) {
      setError("Add a remark or attach a file to record an update.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let attachments = [];
      if (files.length) {
        setUploading(true);
        attachments = await Promise.all(
          files.map(async (f) => {
            const up = await uploadFileToCloudinary(f);
            return { name: up.name || f.name, url: up.url, publicId: up.publicId || "" };
          })
        );
        setUploading(false);
      }

      const { data } = await api.post(`/tasks/${task._id}/progress`, {
        status,
        remark: remark.trim(),
        attachments,
        isReport,
      });

      setRemark("");
      setFiles([]);
      setIsReport(false);
      onChanged?.(data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record the update.");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-7 pb-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${PRIORITY_TONE[task.priority] || ""}`}>
                  {task.priority}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${STATUS_TONE[task.effectiveStatus] || ""}`}>
                  {task.effectiveStatus}
                </span>
                {task.effectiveStatus !== "Completed" && (
                  <span className="text-[11px] font-bold text-gray-400">{dueLabel(task)}</span>
                )}
              </div>
              <h2 className="text-xl font-bold text-[#0F253B] mt-3 break-words">{task.title}</h2>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0" title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-7 space-y-6">
          {/* Description */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-2">Description</p>
            <p className="text-sm font-medium text-gray-600 leading-relaxed whitespace-pre-line">
              {task.description}
            </p>
          </div>

          {task.adminRemarks && (
            <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-2">
                Instructions from admin
              </p>
              <p className="text-sm font-medium text-[#0F253B] whitespace-pre-line">{task.adminRemarks}</p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Meta
              label="Assigned to"
              value={(task.assignees || []).map((a) => displayName(a.email)).join(", ")}
              icon={UserRound}
            />
            <Meta label="Start date" value={fmtDateTime(task.startDate)} icon={CalendarDays} />
            <Meta label="Due date" value={fmtDateTime(task.dueDate)} icon={CalendarClock} />
            <Meta label="Created" value={fmtDateTime(task.createdAt)} />
            <Meta label="Created by" value={task.createdByEmail} />
            <Meta label="Last updated" value={fmtDateTime(task.updatedAt)} />
            <Meta label="Completed" value={task.completedAt ? fmtDateTime(task.completedAt) : ""} />
            <Meta label="Updates" value={String(task.progress?.length || 0)} />
          </div>

          {task.attachments?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-2">
                Task attachments
              </p>
              <AttachmentList items={task.attachments} />
            </div>
          )}

          {/* Add an update */}
          {canUpdate && (
            <form onSubmit={submit} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] flex items-center gap-1.5">
                <MessageSquare size={13} /> Add a progress update
              </p>

              {error && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Status</label>
                  <select className={FIELD} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {SETTABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Attach files</label>
                  <div className="relative border border-dashed border-gray-200 bg-white rounded-xl p-3 text-center text-xs font-bold text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="file"
                      multiple
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    />
                    <span className="truncate block">
                      {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose files…"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className={LABEL}>Remark</label>
                <textarea
                  rows={3}
                  className={FIELD}
                  placeholder="What has moved since the last update?"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isReport}
                  onChange={(e) => setIsReport(e.target.checked)}
                  className="accent-[#F47C3C]"
                />
                <FileCheck2 size={13} className="text-[#F47C3C]" />
                Submit this as a formal report to the admin
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {uploading ? "Uploading…" : saving ? "Saving…" : "Record update"}
              </button>
            </form>
          )}

          {/* History */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3 flex items-center gap-1.5">
              <History size={13} /> Progress history ({history.length})
            </p>

            {history.length === 0 ? (
              <p className="text-sm font-medium text-gray-400">
                No updates yet. Progress recorded against this task will appear here.
              </p>
            ) : (
              <ol className="space-y-3">
                {history.map((entry) => (
                  <li
                    key={entry._id || entry.createdAt}
                    className="relative pl-5 border-l-2 border-gray-100"
                  >
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#F47C3C]" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#0F253B]">
                        {fmtDate(entry.createdAt)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_TONE[entry.status] || ""}`}>
                        {entry.status}
                      </span>
                      {entry.isReport && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0F253B] text-white">
                          Report
                        </span>
                      )}
                    </div>
                    {entry.remark && (
                      <p className="text-sm font-medium text-gray-600 mt-1 whitespace-pre-line">
                        {entry.remark}
                      </p>
                    )}
                    {entry.attachments?.length > 0 && (
                      <div className="mt-2">
                        <AttachmentList items={entry.attachments} />
                      </div>
                    )}
                    <p className="text-[11px] font-medium text-gray-400 mt-1">
                      {entry.authorEmail}
                      {entry.authorRole ? ` · ${entry.authorRole}` : ""}
                      {" · "}
                      {fmtDateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
