"use client";

import { useState } from "react";
import {
  X, Paperclip, Send, Loader2, CalendarClock, CalendarDays, UserRound,
  MessageSquare, FileCheck2, History, Lock, ListChecks,
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
      <p className="text-sm font-bold text-[#0F253B] mt-0.5 flex items-start gap-1.5">
        {Icon && <Icon size={13} className="text-[#F47C3C] shrink-0 mt-[3px]" />}
        {/* The value is wrapped in a span rather than left as a bare text node:
            an anonymous flex item will not shrink below its content, so a long
            unbroken value — an email address, typically — overflowed its grid
            column and ran across the cell beside it. `min-w-0` lets it shrink;
            `wrap-anywhere` gives it somewhere to break, which plain
            `break-words` does not, since that leaves the min-content width
            untouched and an email has no spaces to wrap at. */}
        <span className="min-w-0 wrap-anywhere">{value || "—"}</span>
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
 * Full detail of one task, plus the composer for adding to its timeline.
 *
 * Shared by the admin dashboard and the member task views — everyone on the
 * team sees exactly the same task detail and the same history, which is the
 * point of the feature.
 *
 * What differs is what you may WRITE, and that comes from the server on each
 * task rather than from a role string here:
 *
 *   canComment      — every staff member, on every task. Comments carry no
 *                     status, so they cannot move the work.
 *   canUpdateStatus — the owner, or somebody actually assigned to this task.
 *
 * Nothing here can reassign a task: the only endpoint it calls is
 * POST /tasks/:id/progress, which never touches the assignee list.
 */
export default function TaskDetail({ task, onClose, onChanged, canUpdate = true }) {
  // The server's flags win. `canUpdate` stays as a caller-side override and is
  // the fallback for a task shaped before the flags existed.
  const mayUpdate = canUpdate && (task.canUpdateStatus ?? true);
  const mayComment = task.canComment ?? true;

  const [mode, setMode] = useState(mayUpdate ? "update" : "comment");
  const [status, setStatus] = useState(
    task.status === "Overdue" ? "In Progress" : task.status || "Not Started"
  );
  const [remark, setRemark] = useState("");
  const [isReport, setIsReport] = useState(false);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const commenting = mode === "comment" || !mayUpdate;

  // Newest first, so the most recent entry is what you read first.
  const history = [...(task.progress || [])].reverse();

  const submit = async (e) => {
    e.preventDefault();
    if (!remark.trim() && files.length === 0) {
      setError(
        commenting
          ? "Write a comment or attach a file."
          : "Add a remark or attach a file to record an update."
      );
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
        kind: commenting ? "comment" : "update",
        // Sent only on an update — a comment must not carry a status, or it
        // would look like it moved the task.
        ...(commenting ? {} : { status, isReport }),
        remark: remark.trim(),
        attachments,
      });

      setRemark("");
      setFiles([]);
      setIsReport(false);
      onChanged?.(data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (commenting ? "Failed to add the comment." : "Failed to record the update.")
      );
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

          {/* Composer — a progress update if you own or are assigned this
              task, a comment either way. */}
          {mayComment && (
            <form onSubmit={submit} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4">
              {mayUpdate ? (
                <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit">
                  {[
                    { key: "update", label: "Progress update", icon: ListChecks },
                    { key: "comment", label: "Comment", icon: MessageSquare },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => { setMode(m.key); setError(""); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        mode === m.key ? "bg-[#0F253B] text-white" : "text-gray-400 hover:text-[#0F253B]"
                      }`}
                    >
                      <m.icon size={13} className={mode === m.key ? "text-[#F47C3C]" : ""} />
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] flex items-center gap-1.5">
                  <MessageSquare size={13} /> Add a comment
                </p>
              )}

              {!mayUpdate && (
                <p className="flex items-start gap-2 text-[11px] font-medium text-gray-500 bg-white border border-gray-100 rounded-xl p-3">
                  <Lock size={13} className="text-gray-300 shrink-0 mt-px" />
                  This task is not assigned to you, so you can read it and comment on
                  it — but only the owner or an assignee can change its status.
                </p>
              )}

              {error && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!commenting && (
                  <div>
                    <label className={LABEL}>Status</label>
                    <select className={FIELD} value={status} onChange={(e) => setStatus(e.target.value)}>
                      {SETTABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                <label className={LABEL}>{commenting ? "Comment" : "Remark"}</label>
                <textarea
                  rows={3}
                  className={FIELD}
                  placeholder={
                    commenting
                      ? "Add a note for the team on this task…"
                      : "What has moved since the last update?"
                  }
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </div>

              {!commenting && (
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
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {uploading
                  ? "Uploading…"
                  : saving
                  ? "Saving…"
                  : commenting
                  ? "Post comment"
                  : "Record update"}
              </button>
            </form>
          )}

          {/* History — status updates and comments share one timeline, so the
              conversation sits next to the work it is about. */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3 flex items-center gap-1.5">
              <History size={13} /> Activity ({history.length})
            </p>

            {history.length === 0 ? (
              <p className="text-sm font-medium text-gray-400">
                Nothing yet. Progress updates and comments on this task will appear here.
              </p>
            ) : (
              <ol className="space-y-3">
                {history.map((entry) => {
                  const isComment = entry.kind === "comment";
                  return (
                  <li
                    key={entry._id || entry.createdAt}
                    className="relative pl-5 border-l-2 border-gray-100"
                  >
                    <span
                      className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${
                        isComment ? "bg-gray-300" : "bg-[#F47C3C]"
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#0F253B]">
                        {fmtDate(entry.createdAt)}
                      </span>
                      {isComment ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 flex items-center gap-1">
                          <MessageSquare size={10} /> Comment
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_TONE[entry.status] || ""}`}>
                          {entry.status}
                        </span>
                      )}
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
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
