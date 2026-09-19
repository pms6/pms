"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  X,
  Pencil,
  Search,
  Trees,
  Scissors,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import { MediaUploader, MediaViewerModal } from "./MediaAttachments";
import api from "@/app/api/api";
import { fmtDate, monthKey, monthLabel } from "@/app/utils/cleaningSheet";
import {
  FIELD,
  LABEL,
  money,
  toInputDate,
  filesOf,
  FileStrip,
  ModalShell,
  PropertyFields,
  ErrorBanner,
  SubmitButton,
  ViewRow,
  FilesBlock,
  RowActions,
  EmptyRow,
} from "./registerParts";

/* ------------------------------------------------------------------ *
 * The Garden section — two of the office's sheets on one page:
 *
 *   Garden Cutting   sr | Property | Date | Name | Cost | Before | After
 *   Garden Machines  sr | Property | Machine | Hedge Cutter | Extension |
 *                    Bin Bags | Picked from
 *
 * Every picture column takes photos, video and documents. "sr" is the row
 * number, so it is never stored. MUST stay in sync with
 * backend/models/GardenCutting.js and backend/models/GardenMachine.js.
 * ------------------------------------------------------------------ */

// The machine sheet's columns. MUST stay in sync with GARDEN_MACHINE_ITEMS in
// backend/models/GardenMachine.js.
export const GARDEN_MACHINE_ITEMS = [
  { key: "gardenCuttingMachine", label: "Garden Cutting Machine", placeholder: "e.g. Yes / No / 1" },
  { key: "hedgeCutter", label: "Hedge Cutter", placeholder: "e.g. Yes / No / 1" },
  { key: "extension", label: "Extension", placeholder: "e.g. Yes / No / 10m" },
  { key: "binBags", label: "Bin Bags", placeholder: "e.g. 1 roll" },
  { key: "pickedFrom", label: "Picked from", placeholder: "Where it was picked up from" },
];

const TABS = [
  { key: "cuttings", label: "Garden Cutting", icon: Scissors },
  { key: "machines", label: "Garden Machines", icon: Trees },
];

const itemOf = (row, key) => ({
  value: row?.[key]?.value || "",
  files: filesOf(row?.[key]?.files),
});

// A form's uploader hands its parent either a new list or an updater function
// (files land asynchronously), so a per-field setter has to accept both.
const applyFiles = (updater, prev) => (typeof updater === "function" ? updater(prev) : updater);

/* ------------------------------------------------------------------ *
 * Pieces shared by both sheets
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Garden cutting — add / edit
 * ------------------------------------------------------------------ */
function CuttingModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    date: toInputDate(initial?.date) || toInputDate(new Date()),
    name: initial?.name || "",
    cost: initial?.cost ?? "",
    notes: initial?.notes || "",
  });

  // Kept out of `form` because the uploaders append to them asynchronously
  // while the rest of the form is being typed.
  const [beforeFiles, setBeforeFiles] = useState(() => filesOf(initial?.beforeFiles));
  const [afterFiles, setAfterFiles] = useState(() => filesOf(initial?.afterFiles));
  const [uploading, setUploading] = useState({ before: 0, after: 0 });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    if (!form.date) { setError("Date is required"); return; }
    // Saving mid-upload would drop whatever has not landed yet.
    if (uploading.before || uploading.after) { setError("Wait for the uploads to finish"); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        date: form.date,
        name: form.name.trim(),
        cost: form.cost === "" ? 0 : Number(form.cost),
        notes: form.notes.trim(),
        beforeFiles,
        afterFiles,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Garden Cutting" : "New Garden Cutting"}
      subtitle="Which property, who cut it, what it cost — with before and after pictures"
      onClose={onClose}
    >
      <ErrorBanner>{error}</ErrorBanner>

      <form onSubmit={submit} className="space-y-4">
        <PropertyFields form={form} setForm={setForm} properties={properties} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Garden cutting date</label>
            <input type="date" className={FIELD} value={form.date} onChange={set("date")} required />
          </div>
          <div>
            <label className={LABEL}>Cost (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={FIELD}
              value={form.cost}
              onChange={set("cost")}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Name</label>
          <input className={FIELD} value={form.name} onChange={set("name")} placeholder="Who did the cutting" />
        </div>

        <div>
          <label className={LABEL}>Notes</label>
          <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Anything worth remembering…" />
        </div>

        <MediaUploader
          files={beforeFiles}
          onChange={setBeforeFiles}
          onUploadingChange={(n) => setUploading((u) => ({ ...u, before: n }))}
          label="Before pictures + videos"
          hint="Drop files here, or click to choose — photos, video, any file type"
        />

        <MediaUploader
          files={afterFiles}
          onChange={setAfterFiles}
          onUploadingChange={(n) => setUploading((u) => ({ ...u, after: n }))}
          label="After pictures + videos"
          hint="Drop files here, or click to choose — photos, video, any file type"
        />

        <SubmitButton saving={saving} isEdit={isEdit} />
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Garden machines — add / edit
 * ------------------------------------------------------------------ */
function MachineModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    notes: initial?.notes || "",
  });

  // One { value, files } per column of the sheet.
  const [items, setItems] = useState(() =>
    Object.fromEntries(GARDEN_MACHINE_ITEMS.map(({ key }) => [key, itemOf(initial, key)]))
  );
  const [uploading, setUploading] = useState({});

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setValue = (key) => (e) =>
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], value: e.target.value } }));
  const setFiles = (key) => (updater) =>
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], files: applyFiles(updater, prev[key].files) },
    }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    if (Object.values(uploading).some(Boolean)) { setError("Wait for the uploads to finish"); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        notes: form.notes.trim(),
        ...Object.fromEntries(
          GARDEN_MACHINE_ITEMS.map(({ key }) => [
            key,
            { value: items[key].value.trim(), files: items[key].files },
          ])
        ),
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Garden Machines" : "New Garden Machines Entry"}
      subtitle="What garden equipment is at the property — every line can carry pictures"
      onClose={onClose}
    >
      <ErrorBanner>{error}</ErrorBanner>

      <form onSubmit={submit} className="space-y-4">
        <PropertyFields form={form} setForm={setForm} properties={properties} />

        {GARDEN_MACHINE_ITEMS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-3 rounded-2xl border border-gray-100 p-4">
            <div>
              <label className={LABEL}>{label}</label>
              <input
                className={FIELD}
                value={items[key].value}
                onChange={setValue(key)}
                placeholder={placeholder}
              />
            </div>
            <MediaUploader
              files={items[key].files}
              onChange={setFiles(key)}
              onUploadingChange={(n) => setUploading((u) => ({ ...u, [key]: n }))}
              label={`${label} — pictures + videos`}
              hint="Drop files here, or click to choose"
            />
          </div>
        ))}

        <div>
          <label className={LABEL}>Notes</label>
          <textarea rows={2} className={FIELD} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Anything worth remembering…" />
        </div>

        <SubmitButton saving={saving} isEdit={isEdit} />
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Read-only detail — everything on one entry, attachments included
 * ------------------------------------------------------------------ */
function ViewModal({ kind, row, onClose, onEdit, onOpenFiles }) {
  const isCutting = kind === "cuttings";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] break-words">{row.property}</h3>
            <p className="text-xs text-gray-400 font-medium">
              {isCutting ? `Garden cutting · ${fmtDate(row.date)}` : "Garden machines"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={isCutting ? "orange" : "blue"}>{isCutting ? "Cutting" : "Machines"}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        {isCutting ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <ViewRow label="Date">{fmtDate(row.date)}</ViewRow>
              <ViewRow label="Name">{row.name}</ViewRow>
              <ViewRow label="Cost">{money(row.cost)}</ViewRow>
            </div>

            {row.notes && (
              <div>
                <p className={LABEL}>Notes</p>
                <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{row.notes}</p>
              </div>
            )}

            <FilesBlock
              label="Before pictures + videos"
              files={filesOf(row.beforeFiles)}
              onOpen={() => onOpenFiles(row, "before", `Before · ${fmtDate(row.date)}`, filesOf(row.beforeFiles))}
            />
            <FilesBlock
              label="After pictures + videos"
              files={filesOf(row.afterFiles)}
              onOpen={() => onOpenFiles(row, "after", `After · ${fmtDate(row.date)}`, filesOf(row.afterFiles))}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {GARDEN_MACHINE_ITEMS.map(({ key, label }) => {
              const item = itemOf(row, key);
              return (
                <div key={key} className="space-y-3 rounded-2xl border border-gray-100 p-4">
                  <ViewRow label={label}>{item.value}</ViewRow>
                  <FilesBlock
                    label="Pictures + videos"
                    files={item.files}
                    onOpen={() => onOpenFiles(row, key, label, item.files)}
                  />
                </div>
              );
            })}

            {row.notes && (
              <div>
                <p className={LABEL}>Notes</p>
                <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{row.notes}</p>
              </div>
            )}
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
export default function GardenBoard({
  subtitle = "Garden cuttings and the garden machines at each property",
}) {
  const [tab, setTab] = useState("cuttings");

  const [cuttings, setCuttings] = useState([]);
  const [machines, setMachines] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");

  // { kind: "cuttings" | "machines", row } — {} row = create.
  const [modal, setModal] = useState(null);
  // The entry whose full detail is open: { kind, row }.
  const [viewing, setViewing] = useState(null);
  // What the media viewer is open on: { key, title, subtitle, files }.
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cutRes, machRes, propsRes] = await Promise.all([
        api.get("/garden/cuttings"),
        api.get("/garden/machines"),
        api.get("/properties", { params: { limit: 200 } }),
      ]);
      setCuttings(cutRes.data.data || []);
      setMachines(machRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load garden data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const switchTab = (next) => {
    setTab(next);
    setQ("");
    setMonth("");
  };

  const months = useMemo(() => {
    const seen = new Set(cuttings.map((r) => monthKey(r.date)).filter(Boolean));
    return [...seen].sort().reverse();
  }, [cuttings]);

  const needle = q.trim().toLowerCase();

  const visibleCuttings = useMemo(
    () =>
      cuttings
        .filter((r) => (month ? monthKey(r.date) === month : true))
        .filter((r) =>
          needle
            ? [r.property, r.name, r.notes].some((v) => String(v || "").toLowerCase().includes(needle))
            : true
        ),
    [cuttings, month, needle]
  );

  const visibleMachines = useMemo(
    () =>
      machines.filter((r) =>
        needle
          ? [
              r.property,
              r.notes,
              ...GARDEN_MACHINE_ITEMS.map(({ key }) => r[key]?.value),
            ].some((v) => String(v || "").toLowerCase().includes(needle))
          : true
      ),
    [machines, needle]
  );

  const save = async (payload) => {
    const { kind, row } = modal;
    const base = `/garden/${kind}`;
    if (row?._id) await api.put(`${base}/${row._id}`, payload);
    else await api.post(base, payload);
    setModal(null);
    await load();
  };

  const remove = async (kind, row) => {
    const what = kind === "cuttings" ? `the ${fmtDate(row.date)} garden cutting` : "this machines entry";
    if (!confirm(`Delete ${what} for "${row.property}"?`)) return;

    setViewing((v) => (v?.row._id === row._id ? null : v));
    const setRows = kind === "cuttings" ? setCuttings : setMachines;
    const snapshot = kind === "cuttings" ? cuttings : machines;
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/garden/${kind}/${row._id}`);
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const openViewer = (row, field, label, files) =>
    setViewer({ key: `${row._id}-${field}`, title: row.property, subtitle: label, files });

  const totalCost = visibleCuttings.reduce((sum, r) => sum + Number(r.cost || 0), 0);
  const countFiles = (rows, pick) => rows.reduce((sum, r) => sum + pick(r).length, 0);

  const cards =
    tab === "cuttings"
      ? [
          { label: "Cuttings", value: visibleCuttings.length },
          { label: "Total cost", value: money(totalCost) },
          {
            label: "Pictures + videos",
            value: countFiles(visibleCuttings, (r) => [...filesOf(r.beforeFiles), ...filesOf(r.afterFiles)]),
          },
        ]
      : [
          { label: "Properties", value: visibleMachines.length },
          {
            label: "Pictures + videos",
            value: countFiles(visibleMachines, (r) =>
              GARDEN_MACHINE_ITEMS.flatMap(({ key }) => filesOf(r[key]?.files))
            ),
          },
        ];

  const thClass = "px-4 py-3";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Garden"
        subtitle={subtitle}
        action={
          <button
            onClick={() => setModal({ kind: tab, row: {} })}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> {tab === "cuttings" ? "New Cutting" : "New Machines Entry"}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={load} className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold">Retry</button>
        </div>
      )}

      {/* The two sheets, one tab each */}
      <div className="grid grid-cols-2 gap-2 max-w-md">
        {TABS.map(({ key, label, icon: Icon }) => {
          const selected = tab === key;
          const count = key === "cuttings" ? cuttings.length : machines.length;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                selected
                  ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                  : "bg-white text-[#0F253B] border-gray-100 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <Icon size={16} className={selected ? "text-[#F47C3C]" : "text-gray-300"} />
              <span className="text-xl font-bold tracking-tight">{loading ? "—" : count}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </button>
          );
        })}
      </div>

      <div className={`grid gap-4 ${cards.length === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
        {cards.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
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
            placeholder={tab === "cuttings" ? "Search property, name…" : "Search property, item…"}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        {tab === "cuttings" && (
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
            {tab === "cuttings" ? (
              <><Scissors size={15} className="text-[#F47C3C]" /> Garden Cutting</>
            ) : (
              <><Trees size={15} className="text-[#F47C3C]" /> Garden Cutting Machines</>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          {tab === "cuttings" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className={`${thClass} w-10`}>Sr</th>
                  <th className={thClass}>Property</th>
                  <th className={`${thClass} w-28`}>Date</th>
                  <th className={thClass}>Name</th>
                  <th className={`${thClass} w-24`}>Cost</th>
                  <th className={thClass}>Before pictures + videos</th>
                  <th className={thClass}>After pictures + videos</th>
                  <th className={`${thClass} w-32 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCuttings.length === 0 ? (
                  <EmptyRow
                    colSpan={8}
                    loading={loading}
                    anyRows={cuttings.length > 0}
                    emptyText="No garden cuttings recorded yet"
                  />
                ) : (
                  visibleCuttings.map((r, i) => (
                    <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F253B]">{r.property}</p>
                        {r.notes && <p className="text-[11px] font-medium text-gray-400 truncate max-w-xs">{r.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">{r.name || "—"}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-bold whitespace-nowrap">{money(r.cost)}</td>
                      <td className="px-4 py-3">
                        <FileStrip
                          files={filesOf(r.beforeFiles)}
                          onOpen={() => openViewer(r, "before", `Before · ${fmtDate(r.date)}`, filesOf(r.beforeFiles))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <FileStrip
                          files={filesOf(r.afterFiles)}
                          onOpen={() => openViewer(r, "after", `After · ${fmtDate(r.date)}`, filesOf(r.afterFiles))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onView={() => setViewing({ kind: "cuttings", row: r })}
                          onEdit={() => setModal({ kind: "cuttings", row: r })}
                          onDelete={() => remove("cuttings", r)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {visibleCuttings.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50/50 border-t border-gray-100">
                    <td colSpan={4} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</td>
                    <td className="px-4 py-3 font-bold text-[#0F253B] whitespace-nowrap">{money(totalCost)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className={`${thClass} w-10`}>Sr</th>
                  <th className={thClass}>Property</th>
                  {GARDEN_MACHINE_ITEMS.map(({ key, label }) => (
                    <th key={key} className={thClass}>{label}</th>
                  ))}
                  <th className={`${thClass} w-32 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleMachines.length === 0 ? (
                  <EmptyRow
                    colSpan={3 + GARDEN_MACHINE_ITEMS.length}
                    loading={loading}
                    anyRows={machines.length > 0}
                    emptyText="No garden machines recorded yet"
                  />
                ) : (
                  visibleMachines.map((r, i) => (
                    <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F253B]">{r.property}</p>
                        {r.notes && <p className="text-[11px] font-medium text-gray-400 truncate max-w-xs">{r.notes}</p>}
                      </td>
                      {GARDEN_MACHINE_ITEMS.map(({ key, label }) => {
                        const item = itemOf(r, key);
                        return (
                          <td key={key} className="px-4 py-3 space-y-1.5">
                            <p className="font-medium text-[#0F253B]">{item.value || <span className="text-gray-300">—</span>}</p>
                            {item.files.length > 0 && (
                              <FileStrip
                                files={item.files}
                                onOpen={() => openViewer(r, key, label, item.files)}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3">
                        <RowActions
                          onView={() => setViewing({ kind: "machines", row: r })}
                          onEdit={() => setModal({ kind: "machines", row: r })}
                          onDelete={() => remove("machines", r)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewing && (
        <ViewModal
          kind={viewing.kind}
          row={viewing.row}
          onClose={() => setViewing(null)}
          onEdit={(row) => { setViewing(null); setModal({ kind: viewing.kind, row }); }}
          // Swap to the viewer rather than stacking it over the detail panel.
          onOpenFiles={(...args) => { setViewing(null); openViewer(...args); }}
        />
      )}

      {/* Keyed so opening a different set mounts a fresh viewer, which resets
          it to the first file. */}
      {viewer && (
        <MediaViewerModal
          key={viewer.key}
          title={viewer.title}
          subtitle={viewer.subtitle}
          files={viewer.files}
          onClose={() => setViewer(null)}
        />
      )}

      {modal?.kind === "cuttings" && (
        <CuttingModal
          initial={modal.row?._id ? modal.row : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {modal?.kind === "machines" && (
        <MachineModal
          initial={modal.row?._id ? modal.row : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
