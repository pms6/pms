"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search, X, MapPin, DoorOpen, UserRound } from "lucide-react";
import api from "../api/api";

const STATUS_BADGE = {
  active: "bg-emerald-100 text-emerald-700",
  archived: "bg-gray-100 text-gray-500",
};

function PropertyModal({ initial, owners, onOwnersChange, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || "",
    ownerId: initial?.ownerId?._id || initial?.ownerId || "",
    addressLine1: initial?.addressLine1 || "",
    city: initial?.city || "",
    postcode: initial?.postcode || "",
    status: initial?.status || "active",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewOwner, setShowNewOwner] = useState(false);
  const [newOwner, setNewOwner] = useState({ name: "", email: "" });
  const [creatingOwner, setCreatingOwner] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const createOwner = async () => {
    if (!newOwner.name.trim()) return;
    setCreatingOwner(true);
    setError("");
    try {
      const body = { name: newOwner.name };
      if (newOwner.email) body.email = newOwner.email;
      const res = await api.post("/owners", body);
      const owner = res.data.data;
      onOwnersChange([owner, ...owners]);
      setForm((f) => ({ ...f, ownerId: owner._id }));
      setShowNewOwner(false);
      setNewOwner({ name: "", email: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Could not create owner");
    } finally {
      setCreatingOwner(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.ownerId) {
      setError("Please select or create an owner");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await api.patch(`/properties/${initial._id}`, form);
      } else {
        await api.post("/properties", form);
      }
      onSaved();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.details?.[0]?.message || d?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Property" : "Add Property"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Property Name</label>
            <input className={field} value={form.name} onChange={set("name")} required />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Owner</label>
              <button type="button" onClick={() => setShowNewOwner((v) => !v)} className="text-[10px] font-bold text-[#F47C3C] hover:underline">
                {showNewOwner ? "Cancel" : "+ New owner"}
              </button>
            </div>
            {showNewOwner ? (
              <div className="space-y-2 p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                <input className={field} placeholder="Owner name" value={newOwner.name} onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })} />
                <input className={field} placeholder="Email (optional)" value={newOwner.email} onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })} />
                <button type="button" disabled={creatingOwner} onClick={createOwner} className="w-full py-2.5 bg-[#0F253B] text-white text-sm font-bold rounded-lg disabled:opacity-50">
                  {creatingOwner ? "Creating…" : "Create owner"}
                </button>
              </div>
            ) : (
              <select className={field} value={form.ownerId} onChange={set("ownerId")} required>
                <option value="">Select owner…</option>
                {owners.map((o) => (
                  <option key={o._id} value={o._id}>{o.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>Address</label>
            <input className={field} value={form.addressLine1} onChange={set("addressLine1")} placeholder="Street address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>City</label>
              <input className={field} value={form.city} onChange={set("city")} />
            </div>
            <div>
              <label className={labelCls}>Postcode</label>
              <input className={field} value={form.postcode} onChange={set("postcode")} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={field} value={form.status} onChange={set("status")}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEdit ? "Save Changes" : "Create Property"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Reusable properties management surface.
 * @param {string} basePath - route prefix for the rooms link (e.g. "/admin/properties").
 */
export default function PropertiesManager({ basePath }) {
  const [properties, setProperties] = useState([]);
  const [owners, setOwners] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);

  const loadOwners = useCallback(async () => {
    try {
      const res = await api.get("/owners", { params: { limit: 100 } });
      setOwners(res.data.data);
    } catch {
      /* owners are optional context; ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 9 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/properties", { params });
      setProperties(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { loadOwners(); }, [loadOwners]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (p) => {
    if (!confirm(`Delete "${p.name}"? Its rooms will be archived too.`)) return;
    try {
      await api.delete(`/properties/${p._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F253B]">Properties</h1>
          <p className="text-sm text-gray-400 font-medium">Manage your portfolio and rooms</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
          <Plus size={18} /> Add Property
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search name, city or postcode…" className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
        </div>
        <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" /></div>
      ) : properties.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-medium">No properties yet. Add your first one.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => (
            <div key={p._id} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-[#0F253B] text-lg leading-tight">{p.name}</h3>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${STATUS_BADGE[p.status] || "bg-gray-100"}`}>{p.status}</span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-gray-500 font-medium flex-1">
                <p className="flex items-center gap-1.5"><MapPin size={13} className="text-gray-300" />{[p.addressLine1, p.city, p.postcode].filter(Boolean).join(", ") || "No address"}</p>
                <p className="flex items-center gap-1.5"><UserRound size={13} className="text-gray-300" />{p.ownerId?.name || "—"}</p>
                <p className="flex items-center gap-1.5"><DoorOpen size={13} className="text-gray-300" />{p.totalRooms || 0} rooms</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
                <Link href={`${basePath}/${p._id}`} className="text-sm font-bold text-[#F47C3C] hover:underline">Manage rooms →</Link>
                <div className="flex gap-1">
                  <button onClick={() => setModal(p)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={15} /></button>
                  <button onClick={() => remove(p)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium">Page {meta.page} of {meta.totalPages} · {meta.total} properties</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-gray-100 bg-white disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-gray-100 bg-white disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}

      {modal !== null && (
        <PropertyModal
          initial={modal._id ? modal : null}
          owners={owners}
          onOwnersChange={setOwners}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
