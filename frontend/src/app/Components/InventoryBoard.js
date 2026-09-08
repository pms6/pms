"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus,
  X,
  Loader2,
  Package,
  Building2,
  DoorOpen,
  ImagePlus,
  Trash2,
  Pencil,
  Eye,
  Search,
  Download,
} from "lucide-react";
import { PageHeader, Badge } from "../Shared/ui";
import { formatMoney } from "@/app/utils/listings";
import {
  CONDITIONS,
  CONDITION_TONE,
  conditionLabel,
  INVENTORY_LOCATIONS,
  BLANK_ITEM,
} from "@/app/utils/inventory";
import { exportInventorySheet, scopeLabel } from "@/app/utils/inventorySheet";
import api from "@/app/api/api";
import uploadToCloudinary from "../utils/uploadToCloudinary";
import { guardModalClose } from "@/app/Shared/modalGuard";

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL =
  "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

// Sentinel for the "whole property" scope, so it can share the room <select>.
const WHOLE_PROPERTY = "__property__";

const toDateInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

/* ------------------------------------------------------------------ *
 * Add / edit one inventory item
 * ------------------------------------------------------------------ */
function ItemModal({ initial, scopes, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  // An existing row knows its scope; a new one starts on the property the
  // table was last filtered to, if any.
  const [propertyId, setPropertyId] = useState(initial?.propertyId || "");
  const [scope, setScope] = useState(
    initial?.scopeType === "room" ? initial.roomId : WHOLE_PROPERTY
  );
  const [form, setForm] = useState({
    ...BLANK_ITEM,
    ...(initial || {}),
    quantity: initial?.quantity ?? 1,
    price: initial?.price ?? "",
    images: initial?.images || [],
    checkedOn: toDateInput(initial?.checkedOn),
    checkedBy: initial?.checkedBy || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const property = scopes.find((p) => p._id === propertyId);
  const rooms = property?.rooms || [];

  const onPropertyChange = (e) => {
    setPropertyId(e.target.value);
    setScope(WHOLE_PROPERTY);
  };

  const addImages = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const result = await uploadToCloudinary(file);
        uploaded.push({ url: result.url, publicId: result.publicId });
      }
      setForm((f) => ({ ...f, images: [...(f.images || []), ...uploaded] }));
    } catch (err) {
      setError(err.message || "Failed to upload photo(s)");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = (i) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!String(form.item || "").trim()) {
      setError("Item name is required");
      return;
    }
    if (!propertyId) {
      setError("Choose the property this item belongs to");
      return;
    }
    if (uploading) {
      setError("Wait for the photos to finish uploading");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        scopeType: scope === WHOLE_PROPERTY ? "property" : "room",
        scopeId: scope === WHOLE_PROPERTY ? propertyId : scope,
        item: String(form.item).trim(),
        location: String(form.location || "").trim(),
        quantity: Number(form.quantity) || 1,
        condition: form.condition || "GOOD",
        price: form.price === "" || form.price == null ? null : Number(form.price),
        notes: String(form.notes || "").trim(),
        images: form.images || [],
        checkedOn: form.checkedOn || null,
        checkedBy: String(form.checkedBy || "").trim(),
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const value = (Number(form.quantity) || 0) * (Number(form.price) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">
              {isEdit ? "Edit Inventory Item" : "Add Inventory Item"}
            </h3>
            <p className="text-xs text-gray-400 font-medium">
              Where it lives, what state it is in and what it would cost to replace
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>
                <Building2 size={11} className="inline mr-1 -mt-0.5" /> Property
              </label>
              <select className={FIELD} value={propertyId} onChange={onPropertyChange} required>
                <option value="">Select a property…</option>
                {scopes.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>
                <DoorOpen size={11} className="inline mr-1 -mt-0.5" /> Room
              </label>
              <select
                className={FIELD}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                disabled={!propertyId}
              >
                <option value={WHOLE_PROPERTY}>Whole property (shared &amp; communal)</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
              {propertyId && rooms.length === 0 && (
                <p className="text-[11px] text-gray-400 font-medium mt-1.5">
                  This property has no rooms yet.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={LABEL}>Item</label>
            <input
              className={FIELD}
              value={form.item}
              onChange={set("item")}
              placeholder="e.g. Two-seater sofa"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Location</label>
              <input
                className={FIELD}
                value={form.location}
                onChange={set("location")}
                list="inventory-locations"
                placeholder="Kitchen, Hallway…"
              />
              <datalist id="inventory-locations">
                {INVENTORY_LOCATIONS.map((l) => <option key={l} value={l} />)}
              </datalist>
            </div>
            <div>
              <label className={LABEL}>Condition</label>
              <select className={FIELD} value={form.condition} onChange={set("condition")}>
                {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Quantity</label>
              <input type="number" min="0" step="1" className={FIELD} value={form.quantity} onChange={set("quantity")} />
            </div>
            <div>
              <label className={LABEL}>Unit Price (£)</label>
              <input type="number" min="0" step="0.01" className={FIELD} value={form.price} onChange={set("price")} placeholder="Blank if unknown" />
            </div>
            <div>
              <label className={LABEL}>Value</label>
              <p className="px-4 py-3 text-sm font-bold text-[#0F253B]">{value ? formatMoney(value) : "—"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Checked On</label>
              <input type="date" className={FIELD} value={form.checkedOn} onChange={set("checkedOn")} />
            </div>
            <div>
              <label className={LABEL}>Checked By</label>
              <input className={FIELD} value={form.checkedBy} onChange={set("checkedBy")} placeholder="Who did the check" />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-gray-400 font-medium">
            The check details belong to the whole schedule for this property or room, not just this item.
          </p>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Marks, damage, serial numbers…" />
          </div>

          {/* Photos */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <ImagePlus size={13} /> Condition Photos
              </p>
              {uploading && (
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" /> Uploading…
                </span>
              )}
            </div>

            <label className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-[#F47C3C] hover:bg-orange-50/40 cursor-pointer transition-all">
              <ImagePlus size={18} className="text-gray-300" />
              <span className="text-xs font-bold text-[#0F253B]">Add photos</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addImages(e.target.files)}
              />
            </label>

            {form.images?.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {form.images.map((img, i) => (
                  <div key={img.url || i} className="relative">
                    <img src={img.url} alt="" className="w-full h-20 object-cover rounded-xl border border-gray-100" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 rounded-lg bg-white/90 text-gray-400 hover:text-red-600 shadow-sm"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {uploading ? "Uploading…" : saving ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
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
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] truncate">{row.item}</h3>
            <p className="text-xs text-gray-400 font-medium">
              {row.propertyName} · {scopeLabel(row)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={CONDITION_TONE[row.condition] || "gray"}>{conditionLabel(row.condition)}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <ViewRow label="Location">{row.location}</ViewRow>
          <ViewRow label="Quantity">{row.quantity}</ViewRow>
          <ViewRow label="Unit Price">{row.price == null ? "—" : formatMoney(row.price)}</ViewRow>
          <ViewRow label="Value">{row.value ? formatMoney(row.value) : "—"}</ViewRow>
          <ViewRow label="Checked On">{fmtDate(row.checkedOn)}</ViewRow>
          <ViewRow label="Checked By">{row.checkedBy}</ViewRow>
        </div>

        {row.notes && (
          <div className="mt-5">
            <p className={LABEL}>Notes</p>
            <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{row.notes}</p>
          </div>
        )}

        {row.images?.length > 0 && (
          <div className="mt-5">
            <p className={LABEL}>Photos ({row.images.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {row.images.map((img, i) => (
                <a key={img.url || i} href={img.url} target="_blank" rel="noreferrer">
                  <img src={img.url} alt="" className="w-full h-28 object-cover rounded-xl border border-gray-100" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onEdit(row)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            <Pencil size={16} /> Edit Item
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
 * Board — every inventory item in the organisation, in one table
 * ------------------------------------------------------------------ */
export default function InventoryBoard() {
  const [rows, setRows] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");

  const [modal, setModal] = useState(null); // {} = create, row = edit
  const [viewing, setViewing] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invRes, scopeRes] = await Promise.all([
        api.get("/inventory"),
        api.get("/inventory/scopes"),
      ]);
      setRows(invRes.data.data || []);
      setScopes(scopeRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (propertyFilter ? r.propertyId === propertyFilter : true))
      .filter((r) => (conditionFilter ? r.condition === conditionFilter : true))
      .filter((r) =>
        needle
          ? [r.item, r.location, r.propertyName, r.roomName, r.notes, r.checkedBy].some((v) =>
              String(v || "").toLowerCase().includes(needle)
            )
          : true
      );
  }, [rows, q, propertyFilter, conditionFilter]);

  // Create or update, then refresh. Throws on failure so the modal shows it.
  const save = async (payload) => {
    if (modal?._id) {
      await api.put(
        `/inventory/${modal.scopeType}/${modal.scopeId}/${modal._id}`,
        payload
      );
    } else {
      await api.post("/inventory", payload);
    }
    setModal(null);
    await load();
  };

  const remove = async (row) => {
    if (!confirm(`Delete "${row.item}" from ${row.propertyName} · ${scopeLabel(row)}?`)) return;
    const snapshot = rows;
    setViewing((v) => (v?._id === row._id ? null : v));
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/inventory/${row.scopeType}/${row.scopeId}/${row._id}`);
      await load();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const exportSheet = async () => {
    setExporting(true);
    try {
      await exportInventorySheet(visible);
    } catch (err) {
      alert(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const totalValue = visible.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  const totalUnits = visible.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const propertiesCovered = new Set(visible.map((r) => r.propertyId)).size;

  const cards = [
    { label: "Items", value: visible.length },
    { label: "Units", value: totalUnits },
    { label: "Total value", value: totalValue ? formatMoney(totalValue) : "—" },
    { label: "Properties", value: propertiesCovered },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        subtitle="Schedule of condition across every property and room"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={exportSheet}
              disabled={exporting || visible.length === 0}
              title={visible.length === 0 ? "Nothing to export" : "Export what this table is showing"}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100 text-[#0F253B] font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Export
            </button>
            <button
              onClick={() => setModal({ propertyId: propertyFilter || "" })}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> Add Item
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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search item, room, location…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All properties</option>
          {scopes.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        <div className="flex gap-2 flex-wrap">
          {[["", "All"], ...CONDITIONS].map(([v, l]) => (
            <button
              key={v || "all"}
              onClick={() => setConditionFilter(v)}
              className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                conditionFilter === v
                  ? "bg-[#0F253B] text-white border-[#0F253B]"
                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Room / Scope</th>
                <th className="px-4 py-3 w-16 text-right">Qty</th>
                <th className="px-4 py-3 w-28">Condition</th>
                <th className="px-4 py-3 w-24 text-right">Unit</th>
                <th className="px-4 py-3 w-24 text-right">Value</th>
                <th className="px-4 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 text-[#F47C3C] flex items-center justify-center mb-3">
                        <Package size={22} />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {rows.length === 0 ? "No inventory recorded yet" : "No items match these filters"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {rows.length === 0
                          ? "Add an item and choose the property or room it belongs to."
                          : "Try clearing the search or the property filter."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((r) => (
                  <tr key={`${r.scopeId}-${r._id}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0F253B]">{r.item}</p>
                      {r.images?.length > 0 && (
                        <p className="text-[11px] font-medium text-gray-400">
                          {r.images.length} photo{r.images.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-medium">{r.location || "—"}</td>
                    <td className="px-4 py-3 font-medium text-[#0F253B]">{r.propertyName || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 font-medium">{scopeLabel(r)}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#0F253B]">{r.quantity}</td>
                    <td className="px-4 py-3">
                      <Badge tone={CONDITION_TONE[r.condition] || "gray"}>{conditionLabel(r.condition)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-medium whitespace-nowrap">
                      {r.price == null ? "—" : formatMoney(r.price)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#0F253B] whitespace-nowrap">
                      {r.value ? formatMoney(r.value) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(r)} title="View" className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"><Eye size={16} /></button>
                        <button onClick={() => setModal(r)} title="Edit" className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
                        <button onClick={() => remove(r)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
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
        <ItemModal
          initial={modal._id ? modal : { propertyId: modal.propertyId || "" }}
          scopes={scopes}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
