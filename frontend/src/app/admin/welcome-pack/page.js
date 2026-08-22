"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Wifi, PhoneCall, Video, Trash2, Edit2, Eye, X, Building2, FileText, Loader2, CalendarClock, EyeOff, Clock } from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import api from "../../api/api";
import { uploadFileToCloudinary } from "@/app/utils/uploadToCloudinary";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

// Pull an id string out of a value that may be a populated object or a raw id.
const idOf = (v) => (typeof v === "object" && v !== null ? v._id : v) || "";

const DAY_MS = 86400000;

// Presets for the duration shortcut. "" = no end date (runs indefinitely),
// "custom" = the operator types the end date themselves.
const DURATIONS = [
  { value: "", label: "Always visible (no end date)" },
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "1 month" },
  { value: "60", label: "2 months" },
  { value: "90", label: "3 months" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "custom", label: "Custom end date…" },
];

// Date <-> "YYYY-MM-DD", the format <input type="date"> speaks.
const toInputDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

const todayInput = () => new Date().toISOString().split("T")[0];

// Inclusive day count, so 21 Aug -> 20 Sep reads as 31 days, matching what the
// duration picker put in.
const daysBetween = (from, until) =>
  Math.round((new Date(until) - new Date(from)) / DAY_MS) + 1;

// Recover which preset an existing window corresponds to, so reopening a saved
// card shows "1 month" rather than always dropping to Custom. The duration is
// never stored — it is derived from the two dates every time.
const durationFromWindow = (from, until) => {
  if (!until) return "";
  if (!from) return "custom";
  const days = daysBetween(from, until);
  return DURATIONS.some((d) => d.value === String(days)) ? String(days) : "custom";
};

// End date implied by a start date + preset length (inclusive of the start day).
const addDuration = (from, days) => {
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days) - 1);
  return d.toISOString().split("T")[0];
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

// Same rule as visibilityStatus() in the backend controller, for cards created
// or edited in-session before the list is refetched.
const visibilityOf = (card) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (card.visibleFrom && new Date(card.visibleFrom) > new Date(today.getTime() + DAY_MS - 1)) return "scheduled";
  if (card.visibleUntil && new Date(card.visibleUntil) < today) return "expired";
  return "live";
};

const VISIBILITY_BADGE = {
  live: { label: "Live in Tenant Hub", cls: "text-emerald-600", Icon: Eye },
  scheduled: { label: "Scheduled", cls: "text-amber-600", Icon: Clock },
  expired: { label: "No longer visible", cls: "text-gray-400", Icon: EyeOff },
};

function CardModal({ properties, initialData, onClose, onSave }) {
  const [form, setForm] = useState({
    propertyId: "", roomId: "", title: "", description: "", wifiNetwork: "",
    wifiPassword: "", emergencyNumber: "", videoUrl: "", documentUrl: "", documentName: "",
    // New cards start visible today with no end date — the least surprising
    // default, and the same behaviour every existing card already has.
    visibleFrom: todayInput(), visibleUntil: ""
  });
  // Not persisted: only drives which end date the presets fill in.
  const [duration, setDuration] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Load the rooms for a property so the operator can optionally target one.
  const loadRooms = useCallback(async (propertyId) => {
    if (!propertyId) { setRooms([]); return; }
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
    if (initialData) {
      const extractedPropertyId = idOf(initialData.propertyId);
      setForm({
        propertyId: extractedPropertyId || "",
        roomId: idOf(initialData.roomId) || "",
        title: initialData.title || "",
        description: initialData.description || "",
        wifiNetwork: initialData.wifiNetwork || "",
        wifiPassword: initialData.wifiPassword || "",
        emergencyNumber: initialData.emergencyNumber || "",
        videoUrl: initialData.videoUrl || "",
        documentUrl: initialData.documentUrl || "",
        documentName: initialData.documentName || "",
        visibleFrom: toInputDate(initialData.visibleFrom),
        visibleUntil: toInputDate(initialData.visibleUntil)
      });
      setDuration(durationFromWindow(initialData.visibleFrom, initialData.visibleUntil));
      setFile(null);
      loadRooms(extractedPropertyId);
    }
  }, [initialData, loadRooms]);

  // The three window controls stay in step: picking a preset recomputes the end
  // date, and moving the start date slides a preset window along with it.
  const onDurationChange = (e) => {
    const value = e.target.value;
    setDuration(value);
    if (value === "") setForm((f) => ({ ...f, visibleUntil: "" }));
    else if (value !== "custom") {
      setForm((f) => ({
        ...f,
        visibleUntil: addDuration(f.visibleFrom || todayInput(), value),
        visibleFrom: f.visibleFrom || todayInput(),
      }));
    }
  };

  const onVisibleFromChange = (e) => {
    const visibleFrom = e.target.value;
    setForm((f) => ({
      ...f,
      visibleFrom,
      visibleUntil:
        duration && duration !== "custom" && visibleFrom
          ? addDuration(visibleFrom, duration)
          : f.visibleUntil,
    }));
  };

  // Typing an end date by hand switches the preset to Custom rather than
  // leaving a stale label above a window it no longer describes.
  const onVisibleUntilChange = (e) => {
    const visibleUntil = e.target.value;
    setForm((f) => ({ ...f, visibleUntil }));
    setDuration(visibleUntil ? durationFromWindow(form.visibleFrom, visibleUntil) : "");
  };

  // When the property changes, reset the room selection and reload rooms.
  const onPropertyChange = (e) => {
    const propertyId = e.target.value;
    setForm((f) => ({ ...f, propertyId, roomId: "" }));
    loadRooms(propertyId);
  };

  const roomLabel = (r) => {
    const name = r.roomName || r.title || "Room";
    return r.roomNumber ? `${name} · #${r.roomNumber}` : name;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.propertyId) return alert("Please map this card to a property!");
    if (form.visibleFrom && form.visibleUntil && form.visibleUntil < form.visibleFrom) {
      return alert("The visible-until date cannot be before the visible-from date.");
    }
    setSaving(true);

    let updatedForm = { ...form };

    if (file) {
      setUploadingFile(true);
      try {
        const uploadResult = await uploadFileToCloudinary(file);
        updatedForm.documentUrl = uploadResult.url;
        updatedForm.documentName = uploadResult.name;
      } catch (err) {
        alert(`File upload failed: ${err.message}`);
        setSaving(false);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    try {
      await onSave(updatedForm, initialData?._id);
      onClose();
    } catch (err) {
      alert("Error saving Info Card configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{initialData ? "Update Info Card" : "New Information Card"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Link to Property</label>
              <select className={FIELD} value={form.propertyId} onChange={onPropertyChange} required>
                <option value="">Select Property</option>
                {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>
                Room <span className="text-gray-300 normal-case tracking-normal">(optional)</span>
              </label>
              <select
                className={`${FIELD} disabled:opacity-60 disabled:cursor-not-allowed`}
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                disabled={!form.propertyId || roomsLoading}
              >
                <option value="">
                  {!form.propertyId
                    ? "Select a property first"
                    : roomsLoading
                    ? "Loading rooms…"
                    : rooms.length === 0
                    ? "Entire property (no rooms found)"
                    : "Entire property"}
                </option>
                {rooms.map((r) => <option key={r._id} value={r._id}>{roomLabel(r)}</option>)}
              </select>
              {form.propertyId && !roomsLoading && rooms.length > 0 && (
                <p className="mt-1 text-[10px] font-semibold text-gray-400">
                  {rooms.length} room{rooms.length === 1 ? "" : "s"} in this property
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={LABEL}>Card Header Title</label>
            <input type="text" className={FIELD} placeholder="e.g. Property Manual & Moving Guidelines" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>

          <div>
            <label className={LABEL}>Description Details</label>
            <textarea rows={3} className={FIELD} placeholder="Provide helpful instructions..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>

          <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>WiFi Network</label>
              <input type="text" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]" placeholder="BT-Hub5" value={form.wifiNetwork} onChange={(e) => setForm({ ...form, wifiNetwork: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>WiFi Password</label>
              <input type="text" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]" placeholder="wifi-pass" value={form.wifiPassword} onChange={(e) => setForm({ ...form, wifiPassword: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>24/7 Call Number</label>
              <input type="text" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]" placeholder="Emergency line" value={form.emergencyNumber} onChange={(e) => setForm({ ...form, emergencyNumber: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Utility Setup Video URL</label>
              <input type="url" className={FIELD} placeholder="YouTube URL" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Reference Documents</label>
              <div className="relative border border-dashed border-gray-200 bg-gray-50 rounded-xl p-2.5 text-center text-xs font-bold text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
                <input type="file" accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files[0])} />
                <span className="truncate block max-w-xs mx-auto">
                  {file ? file.name : form.documentName ? form.documentName : "Upload Document pack..."}
                </span>
              </div>
            </div>
          </div>

          {/* VISIBILITY WINDOW — how long the tenant can see this card */}
          <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#0F253B] uppercase tracking-widest">
              <CalendarClock size={13} className="text-[#F47C3C]" />
              Visible to Tenant
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Visible From</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]"
                  value={form.visibleFrom}
                  onChange={onVisibleFromChange}
                />
              </div>
              <div>
                <label className={LABEL}>Duration</label>
                <select
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]"
                  value={duration}
                  onChange={onDurationChange}
                >
                  {DURATIONS.map((d) => (
                    <option key={d.value || "always"} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Visible Until</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B] disabled:opacity-50 disabled:cursor-not-allowed"
                  value={form.visibleUntil}
                  min={form.visibleFrom || undefined}
                  onChange={onVisibleUntilChange}
                  disabled={duration === ""}
                  placeholder="No end date"
                />
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-500 leading-relaxed">
              {form.visibleUntil ? (
                <>
                  Tenants see this card from{" "}
                  <span className="font-bold text-[#F47C3C]">{fmtDate(form.visibleFrom) }</span>
                  {" until "}
                  <span className="font-bold text-[#F47C3C]">{fmtDate(form.visibleUntil)}</span>
                  {form.visibleFrom && (
                    <> · {daysBetween(form.visibleFrom, form.visibleUntil)} days</>
                  )}
                  . After that it disappears from their Welcome Pack.
                </>
              ) : (
                <>
                  Tenants see this card from{" "}
                  <span className="font-bold text-[#F47C3C]">
                    {form.visibleFrom ? fmtDate(form.visibleFrom) : "immediately"}
                  </span>{" "}
                  onwards, with no end date.
                </>
              )}
            </p>
          </div>

          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {uploadingFile ? "Uploading Attachments..." : "Saving Changes..."}
              </>
            ) : initialData ? (
              "Update Information Card"
            ) : (
              "Create Welcome Pack Card"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WelcomePack() {
  const [properties, setProperties] = useState([]);
  const [infoCards, setInfoCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState("All");
  const [modalState, setModalState] = useState({ open: false, data: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [propsRes, cardsRes] = await Promise.all([
        api.get("/properties", { params: { limit: 100 } }),
        api.get("/welcome-pack")
      ]);
      setProperties(propsRes.data.data || []);
      setInfoCards(cardsRes.data.data || []);
    } catch (err) {
      setError("Failed to load welcome pack data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveCard = async (payload, id) => {
    try {
      if (id) {
        await api.patch(`/welcome-pack/${id}`, payload);
      } else {
        await api.post("/welcome-pack", payload);
      }
      loadData();
    } catch (err) {
      alert("Error saving Info Card configuration");
    }
  };

  const deleteAsset = async (id) => {
    if (!confirm("Are you sure you want to permanently delete this resource component?")) return;
    try {
      await api.delete(`/welcome-pack/${id}`);
      loadData();
    } catch (err) {
      alert("Deletion error triggered.");
    }
  };

  // Extract ID string from populated object safely before filtering 
  const filteredCards = selectedPropertyFilter === "All" 
    ? infoCards 
    : infoCards.filter(c => {
        const cardPropertyId = typeof c.propertyId === "object" && c.propertyId !== null 
          ? c.propertyId._id 
          : c.propertyId;
        return cardPropertyId === selectedPropertyFilter;
      });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Digital Welcome Pack"
        subtitle="Configure property guidelines, parameters, and instruction cards securely accessed by specific tenancies."
        action={
          <button onClick={() => setModalState({ open: true, data: null })} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> New Info Card
          </button>
        }
      />

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Building2 size={14} className="text-[#F47C3C]" /> Filter View by Target Tenancy:
        </div>
        <select
          value={selectedPropertyFilter}
          onChange={(e) => setSelectedPropertyFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none cursor-pointer focus:ring-1 focus:ring-[#F47C3C]"
        >
          <option value="All">All Registered Properties</option>
          {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        {loading ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">Loading modules...</div>
        ) : filteredCards.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">No structured instruction cards active for this scope.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCards.map((card) => {
              // Extract property layout variables safely
              const isPopulated = typeof card.propertyId === "object" && card.propertyId !== null;
              const propertyName = isPopulated
                ? card.propertyId.name
                : (properties.find(p => p._id === card.propertyId)?.name || "Unknown Property");
              const roomName = typeof card.roomId === "object" && card.roomId !== null
                ? (card.roomId.roomName || card.roomId.title)
                : null;
              // Prefer the status the server derived; fall back to the local
              // rule for a card just created in-session.
              const visibility = card.visibility || visibilityOf(card);
              const badge = VISIBILITY_BADGE[visibility] || VISIBILITY_BADGE.live;

              return (
                <div key={card._id} className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#F47C3C] bg-orange-50 px-2 py-0.5 rounded-md">
                          <Building2 size={10} /> {propertyName}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md ${roomName ? "text-indigo-600 bg-indigo-50" : "text-gray-400 bg-gray-100"}`}>
                          {roomName ? `Room · ${roomName}` : "Entire property"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setModalState({ open: true, data: card })} className="p-1 text-gray-300 hover:text-[#0F253B] rounded-md transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteAsset(card._id)} className="p-1 text-gray-300 hover:text-red-500 rounded-md transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="font-bold text-base text-[#0F253B]">{card.title}</h4>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-3">{card.description}</p>
                    
                    <div className="pt-3 border-t border-gray-50 space-y-2 text-[11px] text-gray-600 font-medium">
                      {(card.wifiNetwork || card.wifiPassword) && (
                        <p className="flex items-center gap-1.5 text-gray-500">
                          <Wifi size={12} className="text-[#F47C3C]" /> 
                          Network: <strong className="text-[#0F253B]">{card.wifiNetwork}</strong> · Key: <code>{card.wifiPassword}</code>
                        </p>
                      )}
                      {card.emergencyNumber && (
                        <p className="flex items-center gap-1.5 text-gray-500">
                          <PhoneCall size={12} className="text-emerald-600" /> 
                          Support: <strong className="text-[#0F253B]">{card.emergencyNumber}</strong>
                        </p>
                      )}
                      {card.videoUrl && (
                        <a href={card.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
                          <Video size={12} /> Watch Video Resource Instruction
                        </a>
                      )}
                      {card.documentUrl && (
                        <a href={card.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:underline">
                          <FileText size={12} /> View Document: {card.documentName || "Reference Pack"}
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-5 pt-3 border-t border-gray-50 space-y-1.5">
                    <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${badge.cls}`}>
                      <badge.Icon size={12} /> {badge.label}
                    </div>
                    <p className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                      <CalendarClock size={11} />
                      {card.visibleUntil ? (
                        <>
                          {fmtDate(card.visibleFrom)} → {fmtDate(card.visibleUntil)}
                          {card.visibleFrom && (
                            <span className="text-gray-300">
                              {" · "}{daysBetween(card.visibleFrom, card.visibleUntil)}d
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {card.visibleFrom ? `From ${fmtDate(card.visibleFrom)}` : "Always"}
                          <span className="text-gray-300">{" · no end date"}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalState.open && (
        <CardModal
          properties={properties}
          initialData={modalState.data}
          onClose={() => setModalState({ open: false, data: null })}
          onSave={saveCard}
        />
      )}
    </div>
  );
}