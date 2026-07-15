"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Wrench, User, Building2, PoundSterling, X } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { money } from "../../admin/_data/dummy";
import api from "../../api/api";

const PRIORITY_TONE = { urgent: "red", high: "amber", med: "blue", low: "gray" };
const STATUS_TONE = { open: "blue", assigned: "amber", in_progress: "orange", closed: "green" };
const STATUSES = ["open", "assigned", "in_progress", "closed"];
const PRIORITIES = ["urgent", "high", "med", "low"];

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function RequestModal({ properties, suppliers, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "", propertyId: "", property: "", roomId: "", room: "", category: "General",
    priority: "med", reportedBy: "", supplier: "", cost: "", description: "",
  });
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const roomLabel = (r) => `${r.roomName || r.title || "Room"}${r.roomNumber ? ` · ${r.roomNumber}` : ""}`;

  // Selecting a property loads its rooms and resets the room choice.
  const onPropertyChange = async (e) => {
    const propertyId = e.target.value;
    const property = properties.find((p) => p._id === propertyId)?.name || "";
    setForm((f) => ({ ...f, propertyId, property, roomId: "", room: "" }));
    setRooms([]);
    if (!propertyId) return;
    setRoomsLoading(true);
    try {
      const res = await api.get(`/rooms/property/${propertyId}`);
      setRooms(res.data.data || []);
    } catch {
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  const onRoomChange = (e) => {
    const roomId = e.target.value;
    const room = rooms.find((r) => r._id === roomId);
    setForm((f) => ({ ...f, roomId, room: room ? roomLabel(room) : "" }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: form.title,
        propertyId: form.propertyId || null,
        property: form.property,
        roomId: form.roomId || null,
        room: form.room,
        category: form.category,
        priority: form.priority,
        reportedBy: form.reportedBy,
        supplier: form.supplier,
        cost: form.cost === "" ? null : Number(form.cost),
        description: form.description,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">New Maintenance Request</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div><label className={LABEL}>Title</label><input className={FIELD} value={form.title} onChange={set("title")} placeholder="e.g. Boiler not heating" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Property</label>
              <select className={FIELD} value={form.propertyId} onChange={onPropertyChange}>
                <option value="">Select property</option>
                {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Room / Area</label>
              <select className={FIELD} value={form.roomId} onChange={onRoomChange} disabled={!form.propertyId || roomsLoading}>
                <option value="">{roomsLoading ? "Loading rooms…" : !form.propertyId ? "Select a property first" : "Whole property / communal"}</option>
                {rooms.map((r) => <option key={r._id} value={r._id}>{roomLabel(r)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Priority</label>
              <select className={`${FIELD} capitalize`} value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className={LABEL}>Category</label><input className={FIELD} value={form.category} onChange={set("category")} placeholder="Heating, Plumbing…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Reported By</label><input className={FIELD} value={form.reportedBy} onChange={set("reportedBy")} placeholder="Tenant name" /></div>
            <div>
              <label className={LABEL}>Supplier</label>
              <select className={FIELD} value={form.supplier} onChange={set("supplier")}>
                <option value="">Unassigned</option>
                {suppliers.map((s) => <option key={s._id} value={s.company}>{s.company}</option>)}
              </select>
            </div>
          </div>
          <div><label className={LABEL}>Estimated Cost (£)</label><input type="number" min="0" step="0.01" className={FIELD} value={form.cost} onChange={set("cost")} placeholder="Leave blank if TBC" /></div>
          <div><label className={LABEL}>Description</label><textarea rows={2} className={FIELD} value={form.description} onChange={set("description")} placeholder="Details of the issue…" /></div>

          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]">{saving ? "Creating…" : "Create Request"}</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminMaintenance() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState({ open: 0, urgent: 0, suppliersEngaged: 0, spend: 0 });
  const [properties, setProperties] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

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
      setStats(statsRes.data.data || { open: 0, urgent: 0, suppliersEngaged: 0, spend: 0 });
      setProperties(propsRes.data.data || []);
      setSuppliers(supsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load maintenance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = filter ? list.filter((m) => m.status === filter) : list;

  const create = async (payload) => {
    const res = await api.post("/maintenance", payload);
    const created = res.data.data;
    setList((prev) => [created, ...prev]);
    setShowModal(false);
    load(); // refresh stat cards
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

  const cards = [
    { label: "Open requests", value: stats.open },
    { label: "Urgent", value: stats.urgent },
    { label: "Suppliers engaged", value: stats.suppliersEngaged },
    { label: "Spend (30d)", value: money(stats.spend) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance"
        subtitle="Repair requests, suppliers and costs"
        action={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> New Request
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", ...STATUSES].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${filter === s ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
            {s ? s.replace("_", " ") : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">Loading maintenance requests…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">No maintenance requests {filter ? "with this status" : "yet"}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((m) => (
            <div key={m._id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all">
              <div className="relative h-36 bg-gray-100">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt={m.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300"><Wrench size={28} /></div>
                )}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <Badge tone={PRIORITY_TONE[m.priority] || "gray"}>{m.priority}</Badge>
                </div>
                <div className="absolute top-2 right-2">
                  <Badge tone={STATUS_TONE[m.status] || "gray"}>{m.status.replace("_", " ")}</Badge>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[#0F253B]">{m.title}</p>
                  <span className="text-[10px] font-bold text-gray-300">#{m.ref}</span>
                </div>
                <p className="text-xs text-gray-400 font-medium mt-1 flex items-center gap-1.5"><Building2 size={12} />{m.property || "—"}{m.room ? ` · ${m.room}` : ""}</p>
                <div className="mt-3 space-y-1.5 text-xs text-gray-500 font-medium">
                  <p className="flex items-center gap-1.5"><User size={12} className="text-gray-300" />Reported by {m.reportedBy || "—"}</p>
                  <p className="flex items-center gap-1.5"><Wrench size={12} className="text-gray-300" />{m.supplier || "Unassigned"}</p>
                  <p className="flex items-center gap-1.5"><PoundSterling size={12} className="text-gray-300" />{m.cost != null ? money(m.cost) : "TBC"} · {m.category}</p>
                </div>
                <select value={m.status} onChange={(e) => changeStatus(m, e.target.value)} className="mt-3 w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] capitalize">
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RequestModal properties={properties} suppliers={suppliers} onClose={() => setShowModal(false)} onSave={create} />
      )}
    </div>
  );
}
