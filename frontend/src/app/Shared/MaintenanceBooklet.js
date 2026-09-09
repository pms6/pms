"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Eye,
  Wrench,
  Building2,
  User,
  PoundSterling,
  ListOrdered,
  UploadCloud,
  Download,
  Film,
  ImageIcon,
  FileText,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import api from "@/app/api/api";
import { uploadMediaToCloudinary } from "@/app/utils/uploadToCloudinary";
import { exportMaintenanceSheet } from "@/app/utils/maintenanceSheet";
import { guardModalClose } from "@/app/Shared/modalGuard";

/* ------------------------------------------------------------------ *
 * The Maintenance Booklet — the sheet the office keeps by hand:
 *   Sr# | Property | Date | Issue | Status | Cost | Solution
 * where "Solution" is a named procedure made of numbered steps.
 * Shared so admin and manager portals behave identically.
 * MUST stay in sync with backend/models/Maintenance.js.
 * ------------------------------------------------------------------ */

// The statuses an operator can pick. "open" and "closed" were dropped from the
// vocabulary — "pending" covers a request not yet started and "sorted" covers
// one that is done.
export const STATUSES = ["pending", "assigned", "in_progress", "sorted"];
// Still counts a legacy "closed" row as resolved so old data reads correctly.
export const RESOLVED_STATUSES = ["sorted", "closed"];
const PRIORITIES = ["urgent", "high", "med", "low"];

// Tones cover the legacy "open" / "closed" values too, so an un-migrated row
// still gets a coloured badge.
const STATUS_TONE = {
  pending: "amber",
  open: "blue",
  assigned: "blue",
  in_progress: "orange",
  sorted: "green",
  closed: "gray",
};

// The options for a status <select>, including the row's current value when it
// is a legacy one no longer offered — so editing such a row still works and the
// operator can move it onto the new vocabulary.
const statusOptions = (current) =>
  current && !STATUSES.includes(current) ? [current, ...STATUSES] : STATUSES;
const PRIORITY_TONE = { urgent: "red", high: "amber", med: "blue", low: "gray" };

const nice = (s) => String(s || "").replace(/_/g, " ");
const money = (n) => `£${Number(n || 0).toLocaleString("en-GB")}`;

// The booklet prints dates as 03/08/2026.
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
};

// <input type="date"> wants yyyy-mm-dd.
const toInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

const blankStep = () => ({ title: "", detail: "" });

const isVideo = (item) =>
  item?.type === "video" || /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(item?.url || "");

const isPdf = (item) =>
  item?.type === "pdf" ||
  item?.format === "pdf" ||
  /\.pdf(\?|$)/i.test(item?.url || "");

// Icon + label for an attachment's caption line.
const mediaKind = (item) => (isVideo(item) ? "Video" : isPdf(item) ? "PDF" : "Photo");

// Older entries stored a single `image` string; fold it into the gallery so
// nothing uploaded before the media field existed disappears from the screen.
const mediaOf = (m) => {
  const list = Array.isArray(m?.media) ? m.media : [];
  if (m?.image && !list.some((x) => x.url === m.image)) {
    return [{ url: m.image, type: "image", name: "" }, ...list];
  }
  return list;
};

/** One read-only attachment tile — a thumbnail, an inline video player, or a
 * PDF card that opens the document in a new tab. */
function MediaTile({ item, className = "" }) {
  if (isVideo(item)) {
    return (
      <video src={item.url} controls className={`rounded-xl border border-gray-100 bg-black object-cover ${className}`} />
    );
  }
  if (isPdf(item)) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        title={item.name || "Open PDF"}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-100 bg-red-50 text-red-600 hover:bg-red-100 transition-colors ${className}`}
      >
        <FileText size={22} />
        <span className="text-[10px] font-bold uppercase tracking-widest">PDF</span>
      </a>
    );
  }
  return (
    <a href={item.url} target="_blank" rel="noreferrer">
      <img
        src={item.url}
        alt={item.name || "Attachment"}
        className={`rounded-xl border border-gray-100 object-cover ${className}`}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    </a>
  );
}

/** The label under a row's field in the read-only view. */
function ViewRow({ label, children }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className="text-sm font-semibold text-[#0F253B] break-words">{children || "—"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Create / edit modal
 * ------------------------------------------------------------------ */
function RequestModal({ initial, properties, suppliers, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    title: initial?.title || "",
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    roomId: initial?.roomId || "",
    room: initial?.room || "",
    date: toInputDate(initial?.date) || toInputDate(new Date()),
    category: initial?.category || "General",
    priority: initial?.priority || "med",
    status: initial?.status || "pending",
    reportedBy: initial?.reportedBy || "",
    supplier: initial?.supplier || "",
    cost: initial?.cost ?? "",
    description: initial?.description || "",
    solutionTitle: initial?.solutionTitle || "",
    solutionSteps:
      initial?.solutionSteps?.length > 0
        ? initial.solutionSteps.map((s) => ({ title: s.title || "", detail: s.detail || "" }))
        : [blankStep()],
    media: mediaOf(initial),
  });
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const roomLabel = (r) => `${r.roomName || r.title || "Room"}${r.roomNumber ? ` · ${r.roomNumber}` : ""}`;

  // An existing entry already has a property — load its rooms so the picker
  // isn't empty when the operator opens the edit form.
  const loadRooms = useCallback(async (propertyId) => {
    if (!propertyId) {
      setRooms([]);
      return;
    }
    setRoomsLoading(true);
    try {
      const res = await api.get(`/rooms/property/${propertyId}`);
      setRooms(res.data.data || []);
    } catch {
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial?.propertyId) loadRooms(initial.propertyId);
  }, [initial?.propertyId, loadRooms]);

  // Selecting a property loads its rooms and resets the room choice.
  const onPropertyChange = (e) => {
    const propertyId = e.target.value;
    const property = properties.find((p) => p._id === propertyId)?.name || "";
    setForm((f) => ({ ...f, propertyId, property, roomId: "", room: "" }));
    setRooms([]);
    loadRooms(propertyId);
  };

  const onRoomChange = (e) => {
    const roomId = e.target.value;
    const room = rooms.find((r) => r._id === roomId);
    setForm((f) => ({ ...f, roomId, room: room ? roomLabel(room) : "" }));
  };

  /* --- solution procedure steps --- */
  const setStep = (i, key) => (e) =>
    setForm((f) => {
      const solutionSteps = f.solutionSteps.map((s, idx) =>
        idx === i ? { ...s, [key]: e.target.value } : s
      );
      return { ...f, solutionSteps };
    });

  const addStep = () => setForm((f) => ({ ...f, solutionSteps: [...f.solutionSteps, blankStep()] }));

  const removeStep = (i) =>
    setForm((f) => {
      const rest = f.solutionSteps.filter((_, idx) => idx !== i);
      return { ...f, solutionSteps: rest.length ? rest : [blankStep()] };
    });

  const moveStep = (i, dir) =>
    setForm((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.solutionSteps.length) return f;
      const solutionSteps = [...f.solutionSteps];
      [solutionSteps[i], solutionSteps[j]] = [solutionSteps[j], solutionSteps[i]];
      return { ...f, solutionSteps };
    });

  /* --- photos and videos --- */
  // Uploads run one at a time so a failure names the file that failed and the
  // ones already up are kept.
  const addMedia = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // let the same file be picked again after a removal
    if (!files.length) return;

    setError("");
    setUploading(files.length);
    for (const file of files) {
      try {
        const item = await uploadMediaToCloudinary(file);
        setForm((f) => ({ ...f, media: [...f.media, item] }));
      } catch (err) {
        setError(err.message || `Could not upload "${file.name}"`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const removeMedia = (url) =>
    setForm((f) => ({ ...f, media: f.media.filter((x) => x.url !== url) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Issue is required");
      return;
    }
    if (uploading > 0) {
      setError("Wait for the uploads to finish");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: form.title.trim(),
        propertyId: form.propertyId || null,
        property: form.property,
        roomId: form.roomId || null,
        room: form.room,
        date: form.date || null,
        category: form.category,
        priority: form.priority,
        status: form.status,
        reportedBy: form.reportedBy,
        supplier: form.supplier,
        cost: form.cost === "" ? null : Number(form.cost),
        description: form.description,
        solutionTitle: form.solutionTitle.trim(),
        solutionSteps: form.solutionSteps
          .map((s) => ({ title: s.title.trim(), detail: s.detail.trim() }))
          .filter((s) => s.title || s.detail),
        media: form.media,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">
              {isEdit ? `Edit Entry${initial.srNo ? ` #${initial.srNo}` : ""}` : "New Booklet Entry"}
            </h3>
            <p className="text-xs text-gray-400 font-medium">Property, issue, status and the solution taken</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Issue</label>
            <input className={FIELD} value={form.title} onChange={set("title")} placeholder="e.g. Bulky Items Collection" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Property</label>
              <select className={FIELD} value={form.propertyId} onChange={onPropertyChange}>
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Room / Area</label>
              <select className={FIELD} value={form.roomId} onChange={onRoomChange} disabled={!form.propertyId || roomsLoading}>
                <option value="">
                  {roomsLoading ? "Loading rooms…" : !form.propertyId ? "Select a property first" : "Whole property / communal"}
                </option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>{roomLabel(r)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" className={FIELD} value={form.date} onChange={set("date")} />
            </div>
            <div>
              <label className={LABEL}>Status</label>
              <select className={`${FIELD} capitalize`} value={form.status} onChange={set("status")}>
                {statusOptions(form.status).map((s) => (
                  <option key={s} value={s}>{nice(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Cost (£)</label>
              <input type="number" min="0" step="0.01" className={FIELD} value={form.cost} onChange={set("cost")} placeholder="Blank if none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Priority</label>
              <select className={`${FIELD} capitalize`} value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Category</label>
              <input className={FIELD} value={form.category} onChange={set("category")} placeholder="Heating, Plumbing…" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Reported By</label>
              <input className={FIELD} value={form.reportedBy} onChange={set("reportedBy")} placeholder="Tenant name" />
            </div>
            <div>
              <label className={LABEL}>Supplier / Contractor</label>
              <select className={FIELD} value={form.supplier} onChange={set("supplier")}>
                <option value="">Unassigned</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s.company}>{s.company}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea rows={2} className={FIELD} value={form.description} onChange={set("description")} placeholder="Details of the issue…" />
          </div>

          {/* ---- Photos, videos & PDFs ---- */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <ImageIcon size={13} /> Photos, Videos &amp; PDFs
              </p>
              {uploading > 0 && (
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" /> Uploading {uploading}…
                </span>
              )}
            </div>

            <label className="flex flex-col items-center justify-center gap-1 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-[#F47C3C] hover:bg-orange-50/40 cursor-pointer transition-all">
              <UploadCloud size={20} className="text-gray-300" />
              <span className="text-xs font-bold text-[#0F253B]">Add photos, videos or PDFs</span>
              <span className="text-[11px] text-gray-400 font-medium">Images &amp; PDFs up to 15MB · video up to 100MB</span>
              <input type="file" accept="image/*,video/*,application/pdf" multiple className="hidden" onChange={addMedia} />
            </label>

            {form.media.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {form.media.map((item) => (
                  <div key={item.url} className="relative group">
                    <MediaTile item={item} className="w-full h-28" />
                    <button
                      type="button"
                      onClick={() => removeMedia(item.url)}
                      title="Remove"
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-white/90 text-gray-400 hover:text-red-600 shadow-sm"
                    >
                      <X size={13} />
                    </button>
                    <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-gray-400 truncate">
                      {isVideo(item) ? <Film size={11} /> : isPdf(item) ? <FileText size={11} /> : <ImageIcon size={11} />}
                      <span className="truncate">{item.name || mediaKind(item)}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- Solution column ---- */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <ListOrdered size={13} /> Solution
              </p>
              <button
                type="button"
                onClick={addStep}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#F47C3C] hover:bg-orange-50 rounded-lg"
              >
                <Plus size={13} /> Add step
              </button>
            </div>

            <input
              className={FIELD}
              value={form.solutionTitle}
              onChange={set("solutionTitle")}
              placeholder="Procedure title — e.g. Bulky Item Collection Procedure"
            />

            {form.solutionSteps.map((s, i) => (
              <div key={i} className="rounded-xl bg-white border border-gray-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 shrink-0 rounded-lg bg-[#0F253B] text-white text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <input
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
                    value={s.title}
                    onChange={setStep(i, "title")}
                    placeholder="Step heading — e.g. Property Inspection"
                  />
                  <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} title="Move up"
                    className="p-1.5 text-gray-300 hover:text-[#0F253B] disabled:opacity-30 disabled:hover:text-gray-300">▲</button>
                  <button type="button" onClick={() => moveStep(i, 1)} disabled={i === form.solutionSteps.length - 1} title="Move down"
                    className="p-1.5 text-gray-300 hover:text-[#0F253B] disabled:opacity-30 disabled:hover:text-gray-300">▼</button>
                  <button type="button" onClick={() => removeStep(i)} title="Remove step"
                    className="p-1.5 text-gray-300 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-[#F47C3C]"
                  value={s.detail}
                  onChange={setStep(i, "detail")}
                  placeholder="What was done at this step…"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving || uploading > 0}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {uploading > 0 ? "Uploading…" : saving ? "Saving…" : isEdit ? "Save Changes" : "Add Entry"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The Solution column, printed the way the booklet prints it: procedure
 * heading, then the numbered steps.
 * ------------------------------------------------------------------ */
function SolutionSteps({ m }) {
  const steps = m.solutionSteps || [];
  return (
    <>
      <p className="text-sm font-bold text-[#0F253B]">{m.solutionTitle || "Solution"}</p>
      {steps.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400 font-medium">No solution recorded yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 shrink-0 rounded-lg bg-[#0F253B] text-white text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="min-w-0">
                {s.title && <p className="text-sm font-bold text-[#0F253B]">{s.title}</p>}
                {s.detail && <p className="text-sm text-gray-500 font-medium leading-relaxed">{s.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Expanded row — a quick look without leaving the sheet
 * ------------------------------------------------------------------ */
function SolutionDetail({ m }) {
  const media = mediaOf(m);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-4 bg-gray-50/70">
      <div className="lg:col-span-2">
        <SolutionSteps m={m} />
      </div>

      <div className="space-y-2 text-xs text-gray-500 font-medium">
        <p className="flex items-center gap-1.5"><Building2 size={12} className="text-gray-300" />{m.property || "—"}{m.room ? ` · ${m.room}` : ""}</p>
        <p className="flex items-center gap-1.5"><User size={12} className="text-gray-300" />Reported by {m.reportedBy || "—"}</p>
        <p className="flex items-center gap-1.5"><Wrench size={12} className="text-gray-300" />{m.supplier || "Unassigned"} · {m.category || "General"}</p>
        <p className="flex items-center gap-1.5"><PoundSterling size={12} className="text-gray-300" />{m.cost != null ? money(m.cost) : "No cost"}</p>
        <p className="flex items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[m.priority] || "gray"}>{m.priority}</Badge>
          <span className="text-[10px] font-bold text-gray-300">{m.ref}</span>
        </p>
        {m.description && <p className="pt-1 whitespace-pre-line text-gray-500">{m.description}</p>}
        {media.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {media.slice(0, 4).map((item) => (
              <MediaTile key={item.url} item={item} className="w-full h-20" />
            ))}
            {media.length > 4 && (
              <p className="col-span-2 text-[11px] font-bold text-gray-400">+{media.length - 4} more — open the entry to see them all</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * View — the whole booklet entry, read-only
 * ------------------------------------------------------------------ */
function ViewModal({ entry, onClose, onEdit }) {
  // Render the row we already have straight away, then refresh from the API so
  // the panel reflects anything a colleague changed since the list was loaded.
  const [m, setM] = useState(entry);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get(`/maintenance/${entry._id}`)
      .then((res) => { if (active && res.data?.data) setM(res.data.data); })
      .catch(() => { /* the row we were handed is good enough */ })
      .finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [entry._id]);

  const media = mediaOf(m);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-[#0F253B] truncate">{m.title}</h3>
              {refreshing && <Loader2 size={14} className="animate-spin text-gray-300" />}
            </div>
            <p className="text-xs text-gray-400 font-medium">
              Entry {m.srNo ? `#${m.srNo}` : "—"}
              {m.ref ? ` · ${m.ref}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={STATUS_TONE[m.status] || "gray"}>{nice(m.status)}</Badge>
            <Badge tone={PRIORITY_TONE[m.priority] || "gray"}>{m.priority}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <ViewRow label="Property">{m.property}</ViewRow>
          <ViewRow label="Room / Area">{m.room}</ViewRow>
          <ViewRow label="Date">{fmtDate(m.date)}</ViewRow>
          <ViewRow label="Category">{m.category}</ViewRow>
          <ViewRow label="Cost">{m.cost != null ? money(m.cost) : "No cost"}</ViewRow>
          <ViewRow label="Reported By">{m.reportedBy}</ViewRow>
          <ViewRow label="Supplier">{m.supplier || "Unassigned"}</ViewRow>
        </div>

        {m.description && (
          <div className="mt-5">
            <p className={LABEL}>Notes</p>
            <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{m.description}</p>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <ListOrdered size={13} /> Solution
          </p>
          <SolutionSteps m={m} />
        </div>

        {media.length > 0 && (
          <div className="mt-5">
            <p className={LABEL}>Photos, Videos &amp; PDFs ({media.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {media.map((item) => (
                <div key={item.url}>
                  <MediaTile item={item} className="w-full h-32" />
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-gray-400 truncate">
                    {isVideo(item) ? <Film size={11} /> : isPdf(item) ? <FileText size={11} /> : <ImageIcon size={11} />}
                    <span className="truncate">{item.name || mediaKind(item)}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onEdit(m)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            <Pencil size={16} /> Edit Entry
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[#0F253B] font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */
export default function MaintenanceBooklet({ subtitle = "Repair issues, status and the solution taken" }) {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState({ open: 0, urgent: 0, resolved: 0, suppliersEngaged: 0, spend: 0 });
  const [properties, setProperties] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {} = create, entry = edit
  const [viewing, setViewing] = useState(null); // read-only detail panel
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mRes, statsRes, propsRes, supsRes] = await Promise.all([
        api.get("/maintenance"),
        api.get("/maintenance/stats"),
        api.get("/properties", { params: { limit: 100 } }),
        api.get("/suppliers"),
      ]);
      setList(mRes.data.data || []);
      setStats(statsRes.data.data || { open: 0, urgent: 0, resolved: 0, suppliersEngaged: 0, spend: 0 });
      setProperties(propsRes.data.data || []);
      setSuppliers(supsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load maintenance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The booklet reads top-to-bottom by Sr#; rows written before Sr# existed
  // fall back to their creation order.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...list]
      .sort((a, b) => (a.srNo || 0) - (b.srNo || 0) || new Date(a.createdAt) - new Date(b.createdAt))
      .filter((m) => (filter ? m.status === filter : true))
      .filter((m) =>
        needle
          ? [m.title, m.property, m.room, m.category, m.supplier, m.reportedBy, m.solutionTitle, m.ref]
              .some((v) => String(v || "").toLowerCase().includes(needle))
          : true
      );
  }, [list, filter, q]);

  // Create or update, then refresh. Throws on failure so the modal shows it.
  const save = async (payload) => {
    if (modal?._id) await api.put(`/maintenance/${modal._id}`, payload);
    else await api.post("/maintenance", payload);
    setModal(null);
    await load();
  };

  const remove = async (m) => {
    if (!confirm(`Delete booklet entry ${m.srNo ? `#${m.srNo} ` : ""}"${m.title}"?`)) return;
    const snapshot = list;
    setViewing((v) => (v?._id === m._id ? null : v));
    setList((prev) => prev.filter((x) => x._id !== m._id));
    try {
      await api.delete(`/maintenance/${m._id}`);
      await load();
    } catch (err) {
      setList(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const changeStatus = async (m, status) => {
    if (status === m.status) return;
    const snapshot = list;
    setList((prev) => prev.map((x) => (x._id === m._id ? { ...x, status } : x)));
    try {
      await api.patch(`/maintenance/${m._id}/status`, { status });
      const statsRes = await api.get("/maintenance/stats");
      setStats(statsRes.data.data || stats);
    } catch (err) {
      setList(snapshot);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  // Exports exactly what the sheet is showing — filters and search included —
  // so an operator can hand over just the pending work.
  const exportSheet = async () => {
    setExporting(true);
    try {
      await exportMaintenanceSheet(rows);
    } catch (err) {
      alert(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const cards = [
    { label: "Entries", value: list.length },
    { label: "Outstanding", value: stats.open },
    { label: "Sorted", value: stats.resolved },
    { label: "Spend (30d)", value: money(stats.spend) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance Booklet"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={exportSheet}
              disabled={exporting || rows.length === 0}
              title={rows.length === 0 ? "Nothing to export" : "Export what this sheet is showing"}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100 text-[#0F253B] font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Export Sheet
            </button>
            <button
              onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> New Entry
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={load} className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search property, issue, supplier…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["", ...STATUSES].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${
                filter === s ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              }`}
            >
              {s ? nice(s) : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 w-14">Sr#</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3 w-28">Date</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3 w-36">Status</th>
                <th className="px-4 py-3 w-24 text-right">Cost</th>
                <th className="px-4 py-3">Solution</th>
                <th className="px-4 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No booklet entries {filter || q ? "match this filter" : "yet"}</td></tr>
              ) : (
                rows.map((m, i) => {
                  const open = expanded === m._id;
                  const steps = m.solutionSteps?.length || 0;
                  return (
                    <FragmentRow
                      key={m._id}
                      m={m}
                      srNo={m.srNo || i + 1}
                      open={open}
                      steps={steps}
                      onToggle={() => setExpanded(open ? null : m._id)}
                      onStatus={(s) => changeStatus(m, s)}
                      onView={() => setViewing(m)}
                      onEdit={() => setModal(m)}
                      onDelete={() => remove(m)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <ViewModal
          entry={viewing}
          onClose={() => setViewing(null)}
          onEdit={(entry) => { setViewing(null); setModal(entry); }}
        />
      )}

      {modal !== null && (
        <RequestModal
          initial={modal._id ? modal : null}
          properties={properties}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// A booklet line plus its (collapsed) solution panel.
function FragmentRow({ m, srNo, open, steps, onToggle, onStatus, onView, onEdit, onDelete }) {
  const attachments = mediaOf(m).length;
  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
        <td className="px-4 py-3 font-bold text-gray-400">{srNo}</td>
        <td className="px-4 py-3 font-bold text-[#0F253B]">{m.property || "—"}{m.room ? <span className="block text-[11px] font-medium text-gray-400">{m.room}</span> : null}</td>
        <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDate(m.date)}</td>
        <td className="px-4 py-3">
          <p className="font-semibold text-[#0F253B]">{m.title}</p>
          <p className="text-[11px] font-medium text-gray-400 flex items-center gap-2">
            {m.category || "General"}
            {attachments > 0 && (
              <span className="inline-flex items-center gap-1 text-gray-400"><ImageIcon size={11} />{attachments}</span>
            )}
          </p>
        </td>
        <td className="px-4 py-3">
          <select
            value={m.status}
            onChange={(e) => onStatus(e.target.value)}
            className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold capitalize outline-none focus:ring-2 focus:ring-[#F47C3C] border border-gray-100 bg-gray-50 text-[#0F253B]`}
          >
            {statusOptions(m.status).map((s) => (
              <option key={s} value={s}>{nice(s)}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-right font-bold text-[#0F253B] whitespace-nowrap">{m.cost != null ? money(m.cost) : "—"}</td>
        <td className="px-4 py-3">
          <button onClick={onToggle} className="flex items-center gap-1.5 text-left text-xs font-bold text-[#F47C3C] hover:underline">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="truncate max-w-[220px]">
              {m.solutionTitle || (steps ? "Solution" : "No solution yet")}
            </span>
            {steps > 0 && <span className="text-[10px] font-bold text-gray-400">({steps})</span>}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button onClick={onView} title="View" className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"><Eye size={16} /></button>
            <button onClick={onEdit} title="Edit" className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
            <button onClick={onDelete} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-gray-100">
          <td colSpan={8} className="p-0"><SolutionDetail m={m} /></td>
        </tr>
      )}
    </>
  );
}
