"use client";

import { useState } from "react";
import {
  X, Paperclip, Send, Loader2, CalendarClock, CalendarDays, UserRound,
  MessageSquare, FileCheck2, History, Lock, ListChecks, Building2,
  RotateCcw, ArrowRight, Hand, Pencil,
} from "lucide-react";
import api from "@/app/api/api";
import { uploadAnyFileToCloudinary } from "@/app/utils/uploadToCloudinary";
import {
  PRIORITY_TONE, STATUS_TONE, SETTABLE_STATUSES, isClosed,
  fmtDate, fmtDateTime, fmtSchedule, displayName, dueLabel, FIELD, LABEL,
} from "./tasks";
import { guardModalClose } from "@/app/Shared/modalGuard";
import AttachmentLightbox from "./AttachmentLightbox";

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

function AttachmentList({ items, onOpen }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((a, i) => (
        <button
          type="button"
          key={a._id || a.url}
          onClick={() => onOpen(items, i)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-bold text-[#0F253B] transition-all max-w-full"
        >
          <Paperclip size={12} className="text-[#F47C3C] shrink-0" />
          <span className="truncate">{a.name || "Attachment"}</span>
        </button>
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
  // Shared task: the assignee to pass the action to with this update. "" keeps
  // it where it is.
  const [handTo, setHandTo] = useState("");
  const [reopening, setReopening] = useState(false);
  // The comment being corrected by its author: { id, text } | null.
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setEditError("");
    try {
      const { data } = await api.patch(`/tasks/${task._id}/progress/${editing.id}`, {
        remark: editing.text.trim(),
      });
      setEditing(null);
      onChanged?.(data.data);
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Failed to update the comment.");
    } finally {
      setSavingEdit(false);
    }
  };
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // The attachment lightbox is scoped to whichever list it was opened from
  // (the task's own files, or one history entry's) — arrows page through
  // that list, not every attachment on the task.
  const [lightbox, setLightbox] = useState(null); // { items, index } | null
  const openLightbox = (items, index) => setLightbox({ items, index });

  const commenting = mode === "comment" || !mayUpdate;

  // Newest first, so the most recent entry is what you read first.
  const history = [...(task.progress || [])].reverse();

  const closed = isClosed(task);
  const shared = (task.assignees || []).length > 1;
  const ownerId = String(task.actionOwner?.userId || "");
  // Everyone the action could be passed to — the assignees other than whoever
  // holds it now.
  const handOverTargets = (task.assignees || []).filter((a) => String(a.userId) !== ownerId);

  // A closed task stays readable and commentable; this puts it back to work.
  const reopen = async () => {
    setReopening(true);
    setError("");
    try {
      const { data } = await api.post(`/tasks/${task._id}/progress`, {
        kind: "update",
        status: "In Progress",
        remark: "Task reopened.",
      });
      setStatus("In Progress");
      onChanged?.(data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to reopen the task.");
    } finally {
      setReopening(false);
    }
  };

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
        // uploadAnyFileToCloudinary, not the PDF/Word/image one: what gets
        // attached to a task comment is whatever the job produced — a
        // spreadsheet of readings, a CSV export, a .msg from a contractor —
        // and rejecting those just pushes the file back into email.
        attachments = await Promise.all(
          files.map(async (f) => {
            const up = await uploadAnyFileToCloudinary(f);
            return { name: up.name || f.name, url: up.url, publicId: up.publicId || "" };
          })
        );
        setUploading(false);
      }

      const { data } = await api.post(`/tasks/${task._id}/progress`, {
        kind: commenting ? "comment" : "update",
        // Sent only on an update — a comment must not carry a status, or it
        // would look like it moved the task.
        ...(commenting ? {} : { status, isReport, ...(handTo ? { handTo } : {}) }),
        remark: remark.trim(),
        attachments,
      });

      setRemark("");
      setFiles([]);
      setIsReport(false);
      setHandTo("");
      onChanged?.(data.data);
      // Posting is the last thing done here — close the panel so the person
      // lands back on the list, which onChanged has just reloaded.
      onClose?.();
    } catch (err) {
      // An upload failure throws a plain Error with the reason (too large,
      // empty file, preset rejected it) and no `response` — without err.message
      // in the chain it collapsed into a bare "Failed to add the comment." and
      // there was no way to tell which file was the problem.
      setError(
        err.response?.data?.message ||
          err.message ||
          (commenting ? "Failed to add the comment." : "Failed to record the update.")
      );
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
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
                {!closed && (
                  <span className="text-[11px] font-bold text-gray-400">{dueLabel(task)}</span>
                )}
                {task.isPrivate && (
                  <span
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0F253B] text-white flex items-center gap-1"
                    title="Only the people assigned, the creator and the organization owner can see this task"
                  >
                    <Lock size={11} /> Private
                  </span>
                )}
              </div>
              {/* Whose move it is — the point of a shared task. */}
              {shared && !closed && task.actionOwner && (
                <p
                  className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                    task.isMyAction
                      ? "bg-[#F47C3C] text-white"
                      : "bg-orange-50 text-[#0F253B] border border-orange-100"
                  }`}
                >
                  <Hand size={13} />
                  {task.isMyAction
                    ? "Your action is required"
                    : `Action required from ${displayName(task.actionOwner.email)}`}
                </p>
              )}
              <h2 className="text-xl font-bold text-[#0F253B] mt-3 break-words">{task.title}</h2>
              {(task.property || task.startDate || task.dueDate) && (
                <p className="mt-1 text-xs font-bold text-gray-500 flex items-center gap-1.5 flex-wrap">
                  {task.property && (
                    <span className="flex items-center gap-1 text-[#F47C3C]">
                      <Building2 size={12} /> {task.property}
                    </span>
                  )}
                  {task.property && (task.startDate || task.dueDate) && (
                    <span className="text-gray-300">·</span>
                  )}
                  {(task.startDate || task.dueDate) && (
                    <span className="flex items-center gap-1">
                      <CalendarClock size={12} className="text-gray-400" /> {fmtSchedule(task)}
                    </span>
                  )}
                </p>
              )}
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
            {task.property && (
              <Meta label="Property" value={task.property} icon={Building2} />
            )}
            <Meta label="Start date (UK)" value={fmtDateTime(task.startDate)} icon={CalendarDays} />
            <Meta label="Due date (UK)" value={fmtDateTime(task.dueDate)} icon={CalendarClock} />
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
              <AttachmentList items={task.attachments} onOpen={openLightbox} />
            </div>
          )}

          {/* A closed task keeps its whole history and can still be commented
              on below; reopening is for when more work is actually needed. */}
          {closed && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
              <p className="text-xs font-medium text-gray-500">
                This task is {task.effectiveStatus === "Cancelled" ? "cancelled" : "completed"}. Its
                history stays here, and anyone on the team can still comment.
              </p>
              {mayUpdate && (
                <button
                  type="button"
                  onClick={reopen}
                  disabled={reopening}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-[#0F253B] font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                >
                  {reopening ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} className="text-[#F47C3C]" />}
                  Reopen task
                </button>
              )}
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

              {/* Hand-over: done with your part, pass the same task on. */}
              {!commenting && shared && handOverTargets.length > 0 && (
                <div>
                  <label className={LABEL}>Pass the action to</label>
                  <select className={FIELD} value={handTo} onChange={(e) => setHandTo(e.target.value)}>
                    <option value="">
                      Keep it with {displayName(task.actionOwner?.email)}
                    </option>
                    {handOverTargets.map((a) => (
                      <option key={String(a.userId)} value={String(a.userId)}>
                        {displayName(a.email)} — {a.email}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] font-medium text-gray-400 mt-1.5">
                    The person you pick is notified that their action is now required.
                  </p>
                </div>
              )}

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
                      {entry.handedToEmail && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-[#F47C3C] flex items-center gap-1">
                          <ArrowRight size={10} /> Passed to {displayName(entry.handedToEmail)}
                        </span>
                      )}
                    </div>
                    {editing?.id === entry._id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={3}
                          className={FIELD}
                          value={editing.text}
                          onChange={(e) => setEditing({ id: entry._id, text: e.target.value })}
                          autoFocus
                        />
                        {editError && (
                          <p className="text-xs font-bold text-red-600">{editError}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={savingEdit || (!editing.text.trim() && !entry.attachments?.length)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50"
                          >
                            {savingEdit && <Loader2 size={12} className="animate-spin" />}
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditing(null); setEditError(""); }}
                            className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-[#0F253B]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      entry.remark && (
                        <p className="text-sm font-medium text-gray-600 mt-1 whitespace-pre-line">
                          {entry.remark}
                        </p>
                      )
                    )}
                    {entry.attachments?.length > 0 && (
                      <div className="mt-2">
                        <AttachmentList items={entry.attachments} onOpen={openLightbox} />
                      </div>
                    )}
                    <p className="text-[11px] font-medium text-gray-400 mt-1">
                      {entry.authorEmail}
                      {entry.authorRole ? ` · ${entry.authorRole}` : ""}
                      {" · "}
                      {fmtDateTime(entry.createdAt)}
                      {entry.editedAt ? " · edited" : ""}
                      {/* Only the author of a comment gets this. */}
                      {entry.canEdit && editing?.id !== entry._id && (
                        <button
                          type="button"
                          onClick={() => { setEditing({ id: entry._id, text: entry.remark || "" }); setEditError(""); }}
                          className="ml-2 inline-flex items-center gap-1 font-bold text-[#F47C3C] hover:underline"
                        >
                          <Pencil size={10} /> Edit
                        </button>
                      )}
                    </p>
                  </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <AttachmentLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox((lb) => ({ ...lb, index }))}
        />
      )}
    </div>
  );
}
