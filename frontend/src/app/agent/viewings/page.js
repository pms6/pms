"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Clock, MapPin, User, CheckCircle, XCircle, Phone, Mail } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";

const useViewingsData = (filter = "") => {
  const { user } = useAuth();
  const organizationId = user?.organization?._id || user?.organizationId;
  const userId = user?._id;

  const [allViewings, setAllViewings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [viewingsLoading, setViewingsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchAllViewings = useCallback(async () => {
    if (!organizationId) return;
    setViewingsLoading(true);
    try {
      const res = await api.get("/viewings");
      const data = res.data?.data || res.data || [];
      setAllViewings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch viewings:", err);
      setAllViewings([]);
    } finally {
      setViewingsLoading(false);
    }
  }, [organizationId]);

  const fetchSupportingData = async () => {
    if (!organizationId) return;
    try {
      const [lRes, pRes, rRes] = await Promise.all([
        api.get("/leads"),
        api.get("/properties"),
        api.get("/rooms")
      ]);
      setLeads(lRes.data?.data || lRes.data || []);
      setProperties(pRes.data?.data || pRes.data || []);
      setAllRooms(rRes.data?.data || rRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const createViewing = async (formData) => {
    if (!organizationId) throw new Error("Organization ID missing");

    const payload = { ...formData, organizationId, createdBy: userId };
    const res = await api.post("/viewings", payload);
    const newViewing = res.data?.data || res.data;
    setAllViewings(prev => [...prev, newViewing]);
    return newViewing;
  };

  const updateViewingStatus = async (id, status) => {
    try {
      const res = await api.patch(`/viewings/${id}/status`, { status });
      const updated = res.data?.data || res.data;
      setAllViewings(prev => prev.map(v => v._id === id ? updated : v));
      return updated;
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
    }
  };

  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      await fetchSupportingData();
      await fetchAllViewings();
      setInitialLoading(false);
    };
    if (organizationId) init();
  }, [organizationId]);

  // Frontend filtering
  const filteredViewings = filter 
    ? allViewings.filter(v => v.status === filter)
    : allViewings;

  return { 
    viewings: filteredViewings,
    allViewings,
    leads, 
    properties, 
    allRooms, 
    viewingsLoading, 
    initialLoading, 
    createViewing,
    updateViewingStatus 
  };
};

// ==================== UI ====================
const STATUS_TONE = { scheduled: "orange", done: "green", cancelled: "gray" };

function prettyDay(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function ViewingModal({ onClose, onCreate, leads, properties, allRooms }) {
  const [form, setForm] = useState({
    date: "2026-07-02",
    time: "10:00",
    lead: "",
    property: "",
    room: "",
    agent: "Ella Moore",
    status: "scheduled",
  });

  const handleChange = (k) => (e) => {
    const value = e.target.value;
    setForm(prev => {
      const newForm = { ...prev, [k]: value };
      if (k === "property") newForm.room = "";
      return newForm;
    });
  };

  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  const availableRooms = form.property 
    ? allRooms.filter(r => r.propertyId === form.property || r.propertyId?._id === form.property)
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onCreate(form);
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to schedule viewing");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">Schedule Viewing</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Date</label>
              <input type="date" className={field} value={form.date} onChange={handleChange("date")} required />
            </div>
            <div><label className={labelCls}>Time</label>
              <input type="time" className={field} value={form.time} onChange={handleChange("time")} required />
            </div>
          </div>

          <div>
            <label className={labelCls}>Lead</label>
            <select className={field} value={form.lead} onChange={handleChange("lead")} required>
              <option value="">Select lead…</option>
              {leads.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Property</label>
              <select className={field} value={form.property} onChange={handleChange("property")}>
                <option value="">—</option>
                {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Room</label>
              <select className={field} value={form.room} onChange={handleChange("room")} disabled={!form.property}>
                <option value="">Select room…</option>
                {availableRooms.map(r => (
                  <option key={r._id} value={r._id}>
                    {r.roomName || r.title} {r.roomNumber ? `(${r.roomNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">
            Schedule Viewing
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminViewings() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const { viewings, leads, properties, allRooms, viewingsLoading, initialLoading, createViewing, updateViewingStatus } = useViewingsData(filter);

  const days = [...new Set(viewings.map(v => v.date))].sort();

  if (authLoading || initialLoading) return <div className="p-8 text-center text-gray-500">Loading data...</div>;
  if (!user) return <div className="p-8 text-center text-red-500">Please log in.</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Viewings"
        subtitle="Scheduled property viewings"
        action={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Schedule
          </button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {["", "scheduled", "done", "cancelled"].map(s => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${
              filter === s ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {viewingsLoading ? (
        <div className="p-12 text-center text-gray-500">Loading viewings...</div>
      ) : (
        <div className="space-y-6">
          {days.map(day => (
            <div key={day}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">{prettyDay(day)}</p>
              <div className="space-y-3">
                {viewings
                  .filter(v => v.date === day)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map(v => (
                    <div key={v._id} className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg transition-all">
                      <div className="flex items-start gap-5">
                        <div className="flex-shrink-0 w-20 text-center pt-1">
                          <Clock size={22} className="text-[#F47C3C] mx-auto" />
                          <div className="font-bold text-xl mt-1 text-[#0F253B]">{v.time}</div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-lg text-[#0F253B]">{v.lead?.name || v.lead}</div>
                            <Badge tone={STATUS_TONE[v.status]} className="capitalize">{v.status}</Badge>
                          </div>

                          <div className="mt-2 text-sm text-gray-600 flex items-center gap-1.5">
                            <MapPin size={16} className="text-gray-400" />
                            <span>{v.property?.name || v.property}</span>
                            {v.room && <span className="text-gray-400">•</span>}
                            <span>{v.room?.roomName || v.room?.title || v.room}</span>
                          </div>

                          {v.lead && (
                            <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                              {v.lead.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail size={16} className="text-gray-400" />
                                  <span>{v.lead.email}</span>
                                </div>
                              )}
                              {v.lead.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone size={16} className="text-gray-400" />
                                  <span>{v.lead.phone}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-gray-500 font-medium">{v.agent}</div>

                          {v.status === "scheduled" && (
                            <div className="flex gap-1 mt-2">
                              <button 
                                onClick={() => updateViewingStatus(v._id, "done")}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                                title="Mark as Done"
                              >
                                <CheckCircle size={20} />
                              </button>
                              <button 
                                onClick={() => updateViewingStatus(v._id, "cancelled")}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                title="Cancel Viewing"
                              >
                                <XCircle size={20} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {viewings.length === 0 && <p className="text-center py-20 text-gray-400 text-lg">No viewings found.</p>}
        </div>
      )}

      {open && (
        <ViewingModal
          onClose={() => setOpen(false)}
          onCreate={createViewing}
          leads={leads}
          properties={properties}
          allRooms={allRooms}
        />
      )}
    </div>
  );
}