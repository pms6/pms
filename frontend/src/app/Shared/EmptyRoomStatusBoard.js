"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Eye,
  Download,
  DoorOpen,
  Building2,
  CheckCircle2,
  Circle,
  LayoutGrid,
  Home,
  Handshake,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import api from "@/app/api/api";
import {
  exportEmptyRoomSheet,
  groupByStatus,
  fmtDate,
} from "@/app/utils/emptyRoomSheet";
import { guardModalClose } from "@/app/Shared/modalGuard";

/* ------------------------------------------------------------------ *
 * The "Available Rooms Status" sheet — one row per empty room being
 * turned around: the make-ready checklist (paint, bedsheet, keys), any
 * outstanding issues, and the dates it emptied and became ready. Rows sit
 * under two headings: Available, then Let Agreed.
 * MUST stay in sync with backend/models/EmptyRoomStatus.js.
 * ------------------------------------------------------------------ */

export const EMPTY_ROOM_STATUSES = ["AVAILABLE", "LET_AGREED"];
const STATUS_LABEL = { AVAILABLE: "Available", LET_AGREED: "Let Agreed" };
const STATUS_TONE = { AVAILABLE: "green", LET_AGREED: "amber" };
const STATUS_ICON = { AVAILABLE: Home, LET_AGREED: Handshake };

export const TURNAROUND_STATUSES = ["PENDING", "DONE"];

// The three make-ready tasks, in the order the sheet lists them.
const CHECKLIST = [
  { key: "paint", label: "Paint" },
  { key: "bedsheet", label: "Bedsheet" },
  { key: "keys", label: "Keys" },
];

const isDone = (v) => v === "DONE";

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

const toInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const matchesSearch = (row, needle) =>
  [
    row.property,
    row.exTenant,
    row.issues,
    row.notes,
    STATUS_LABEL[row.status],
  ].some((v) => String(v || "").toLowerCase().includes(needle));

/* ------------------------------------------------------------------ *
 * A tick, styled like the office's "Done" columns. Interactive when
 * given `onClick`, read-only otherwise.
 * ------------------------------------------------------------------ */
function Tick({ done, label, onClick }) {
  const body = (
    <span className="flex items-center gap-1.5 text-sm font-medium text-[#0F253B]">
      {done ? (
        <CheckCircle2 size={15} className="text-emerald-600" />
      ) : (
        <Circle size={15} className="text-gray-300" />
      )}
      {label}
    </span>
  );
  if (!onClick) return body;
  return (
    <button type="button" onClick={onClick} title={done ? "Mark as pending" : "Mark as done"}>
      {body}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Add / edit one room
 * ------------------------------------------------------------------ */
function EntryModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    exTenant: initial?.exTenant || "",
    status: EMPTY_ROOM_STATUSES.includes(initial?.status) ? initial.status : "AVAILABLE",
    paint: isDone(initial?.paint),
    bedsheet: isDone(initial?.bedsheet),
    keys: isDone(initial?.keys),
    withinSevenDays: Boolean(initial?.withinSevenDays),
    emptyRoomDate: toInputDate(initial?.emptyRoomDate) || toInputDate(new Date()),
    roomReadyDate: toInputDate(initial?.roomReadyDate),
    issues: initial?.issues || "",
    notes: initial?.notes || "",
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k) => () => setForm((f) => ({ ...f, [k]: !f[k] }));

  const onPropertyPick = (e) => {
    const propertyId = e.target.value;
    const name = properties.find((p) => p._id === propertyId)?.name || "";
    setForm((f) => ({ ...f, propertyId, property: name || f.property }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    if (!form.emptyRoomDate) { setError("Empty room date is required"); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        exTenant: form.exTenant.trim(),
        status: form.status,
        paint: form.paint ? "DONE" : "PENDING",
        bedsheet: form.bedsheet ? "DONE" : "PENDING",
        keys: form.keys ? "DONE" : "PENDING",
        withinSevenDays: form.withinSevenDays,
        emptyRoomDate: form.emptyRoomDate,
        roomReadyDate: form.roomReadyDate || "",
        issues: form.issues.trim(),
        notes: form.notes.trim(),
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
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">
              {isEdit ? "Edit Room Status" : "New Room Status"}
            </h3>
            <p className="text-xs text-gray-400 font-medium">Where it is in the turnaround, and the dates</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Pick from portfolio</label>
            <select className={FIELD} value={form.propertyId} onChange={onPropertyPick}>
              <option value="">Not linked — type the address below</option>
              {properties.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Property</label>
              <input
                className={FIELD}
                value={form.property}
                onChange={set("property")}
                placeholder="e.g. 28 Babington Road NW4 4LD"
                required
              />
            </div>
            <div>
              <label className={LABEL}>Ex-Tenant</label>
              <input
                className={FIELD}
                value={form.exTenant}
                onChange={set("exTenant")}
                placeholder="Who moved out"
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Status</label>
            <div className="grid grid-cols-2 gap-2">
              {EMPTY_ROOM_STATUSES.map((s) => {
                const Icon = STATUS_ICON[s];
                const active = form.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                      active
                        ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                        : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                    }`}
                  >
                    <Icon size={15} className={active ? "text-[#F47C3C]" : "text-gray-400"} />
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={LABEL}>Make-ready checklist</label>
            <div className="grid grid-cols-3 gap-2">
              {CHECKLIST.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={toggle(key)}
                  className={`flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    form[key]
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {form[key] ? (
                    <CheckCircle2 size={15} className="text-emerald-600" />
                  ) : (
                    <Circle size={15} className="text-gray-300" />
                  )}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Empty room date</label>
              <input type="date" className={FIELD} value={form.emptyRoomDate} onChange={set("emptyRoomDate")} required />
            </div>
            <div>
              <label className={LABEL}>Room ready date</label>
              <input type="date" className={FIELD} value={form.roomReadyDate} onChange={set("roomReadyDate")} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Within 7 working days</label>
            <button
              type="button"
              onClick={toggle("withinSevenDays")}
              className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                form.withinSevenDays
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {form.withinSevenDays ? (
                <CheckCircle2 size={15} className="text-emerald-600" />
              ) : (
                <Circle size={15} className="text-gray-300" />
              )}
              Within 7 working days
            </button>
          </div>

          <div>
            <label className={LABEL}>Issues</label>
            <textarea
              rows={2}
              className={FIELD}
              value={form.issues}
              onChange={set("issues")}
              placeholder="e.g. Remove rubbish, lock broken…"
            />
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Anything else to flag…" />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Entry"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Read-only detail
 * ------------------------------------------------------------------ */
function ViewRow({ label, children }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className="text-sm font-semibold text-[#0F253B] break-words">{children || "—"}</p>
    </div>
  );
}

function ViewModal({ row, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] break-words">{row.property}</h3>
            <p className="text-xs text-gray-400 font-medium">
              Empty {fmtDate(row.emptyRoomDate)}
              {row.roomReadyDate ? ` · ready ${fmtDate(row.roomReadyDate)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={STATUS_TONE[row.status] || "gray"}>{STATUS_LABEL[row.status] || row.status}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ViewRow label="Ex-Tenant">{row.exTenant}</ViewRow>
          <ViewRow label="Within 7 working days">{row.withinSevenDays ? "Yes" : "No"}</ViewRow>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          {CHECKLIST.map(({ key, label }) => (
            <div key={key}>
              <p className={LABEL}>{label}</p>
              <Tick done={isDone(row[key])} label={isDone(row[key]) ? "Done" : "Pending"} />
            </div>
          ))}
        </div>

        {row.issues && (
          <div className="mt-5">
            <p className={LABEL}>Issues</p>
            <p className="text-sm text-[#0F253B] font-medium whitespace-pre-line leading-relaxed bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3">
              {row.issues}
            </p>
          </div>
        )}

        {row.notes && (
          <div className="mt-5">
            <p className={LABEL}>Notes</p>
            <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{row.notes}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onEdit(row)}
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
export default function EmptyRoomStatusBoard({
  subtitle = "Empty rooms, where each is in the turnaround, and when it will be ready",
}) {
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  // "All" or one of EMPTY_ROOM_STATUSES.
  const [statusFilter, setStatusFilter] = useState("All");

  const [modal, setModal] = useState(null); // {} = create, row = edit
  const [viewing, setViewing] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, propsRes] = await Promise.all([
        api.get("/empty-rooms"),
        api.get("/properties", { params: { limit: 200 } }),
      ]);
      setRows(listRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load available rooms status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusCounts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = rows.filter((r) => (needle ? matchesSearch(r, needle) : true));
    const counts = { All: base.length };
    for (const s of EMPTY_ROOM_STATUSES) counts[s] = 0;
    for (const r of base) {
      if (counts[r.status] !== undefined) counts[r.status]++;
    }
    return counts;
  }, [rows, q]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
      .filter((r) => (needle ? matchesSearch(r, needle) : true));
  }, [rows, q, statusFilter]);

  const groups = useMemo(() => groupByStatus(visible), [visible]);

  const save = async (payload) => {
    if (modal?._id) await api.put(`/empty-rooms/${modal._id}`, payload);
    else await api.post("/empty-rooms", payload);
    setModal(null);
    await load();
  };

  const remove = async (row) => {
    if (!confirm(`Delete the ${row.property} room status?`)) return;
    const snapshot = rows;
    setViewing((v) => (v?._id === row._id ? null : v));
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/empty-rooms/${row._id}`);
      await load();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  // The checklist ticks, the "within 7 days" flag and the status flip in place.
  const patch = async (row, changes) => {
    const snapshot = rows;
    setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, ...changes } : r)));
    try {
      await api.patch(`/empty-rooms/${row._id}`, changes);
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Failed to update");
    }
  };

  const toggleTick = (row, key) =>
    patch(row, { [key]: isDone(row[key]) ? "PENDING" : "DONE" });

  const exportSheet = async () => {
    setExporting(true);
    try {
      await exportEmptyRoomSheet(visible);
    } catch (err) {
      alert(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const readyCount = visible.filter((r) => r.roomReadyDate).length;
  const cards = [
    { label: "Rooms", value: visible.length },
    { label: "Available", value: visible.filter((r) => r.status === "AVAILABLE").length },
    { label: "Let Agreed", value: visible.filter((r) => r.status === "LET_AGREED").length },
    { label: "Ready", value: readyCount },
  ];

  const statusTiles = ["All", ...EMPTY_ROOM_STATUSES];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Available Rooms Status"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={exportSheet}
              disabled={exporting || visible.length === 0}
              title={visible.length === 0 ? "Nothing to export" : "Export what this sheet is showing"}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100 text-[#0F253B] font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Export
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
        {cards.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {statusTiles.map((s) => {
          const Icon = s === "All" ? LayoutGrid : STATUS_ICON[s];
          const count = statusCounts[s] || 0;
          const selected = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[78px] ${
                selected
                  ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                  : "bg-white text-[#0F253B] border-gray-100 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <Icon size={16} className={selected ? "text-[#F47C3C]" : "text-gray-300"} />
              <span className="text-xl font-bold tracking-tight block">{loading ? "—" : count}</span>
              <span className="text-[9px] font-bold block uppercase tracking-wider leading-tight">
                {s === "All" ? "All" : STATUS_LABEL[s]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search property, ex-tenant, issue…"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
            <DoorOpen size={15} className="text-[#F47C3C]" /> Available Rooms Status
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3 w-28">Ex-Tenant</th>
                <th className="px-4 py-3 w-24">Paint</th>
                <th className="px-4 py-3 w-28">Bedsheet</th>
                <th className="px-4 py-3 w-24">Keys</th>
                <th className="px-4 py-3">Issues</th>
                <th className="px-4 py-3 w-32">Empty Date</th>
                <th className="px-4 py-3 w-32">Ready Date</th>
                <th className="px-4 py-3 w-28">Within 7d</th>
                <th className="px-4 py-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-5 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-14">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 text-[#F47C3C] flex items-center justify-center mb-3">
                        <DoorOpen size={22} />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {rows.length === 0 ? "No empty rooms tracked yet" : "No rooms match these filters"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {rows.length === 0
                          ? "Add a room as it empties and work the checklist here."
                          : "Try another status, or clear the search."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <StatusGroup
                    key={group.status}
                    group={group}
                    onView={setViewing}
                    onEdit={setModal}
                    onDelete={remove}
                    onToggleTick={toggleTick}
                    onPatch={patch}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <ViewModal
          row={viewing}
          onClose={() => setViewing(null)}
          onEdit={(row) => { setViewing(null); setModal(row); }}
        />
      )}

      {modal !== null && (
        <EntryModal
          initial={modal._id ? modal : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// One status block — the heading, then its rows, as the sheet prints it.
function StatusGroup({ group, onView, onEdit, onDelete, onToggleTick, onPatch }) {
  return (
    <>
      <tr className="bg-[#0F253B]/[0.03] border-y border-gray-100">
        <td colSpan={11} className="px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0F253B]">
            {group.label}
            <span className="ml-2 font-medium normal-case tracking-normal text-gray-400">
              {group.rows.length} room{group.rows.length === 1 ? "" : "s"}
            </span>
          </p>
        </td>
      </tr>
      {group.rows.map((r, i) => (
        <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
          <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
          <td className="px-4 py-3">
            <p className="font-semibold text-[#0F253B] flex items-center gap-1.5">
              <Building2 size={13} className="text-gray-300 shrink-0" />
              {r.property}
            </p>
            {r.notes && <p className="text-[11px] font-medium text-gray-400 truncate max-w-xs">{r.notes}</p>}
          </td>
          <td className="px-4 py-3 text-gray-500 font-medium">{r.exTenant || "—"}</td>
          {CHECKLIST.map(({ key, label }) => (
            <td key={key} className="px-4 py-3">
              <Tick done={isDone(r[key])} label={label} onClick={() => onToggleTick(r, key)} />
            </td>
          ))}
          <td className="px-4 py-3 text-gray-500 font-medium">
            {r.issues ? (
              <span className="block max-w-xs whitespace-pre-line">{r.issues}</span>
            ) : (
              "—"
            )}
          </td>
          <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDate(r.emptyRoomDate)}</td>
          <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDate(r.roomReadyDate) || "—"}</td>
          <td className="px-4 py-3">
            <Tick
              done={r.withinSevenDays}
              label={r.withinSevenDays ? "Yes" : "No"}
              onClick={() => onPatch(r, { withinSevenDays: !r.withinSevenDays })}
            />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => onView(r)} title="View" className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"><Eye size={16} /></button>
              <button onClick={() => onEdit(r)} title="Edit" className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
              <button onClick={() => onDelete(r)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
