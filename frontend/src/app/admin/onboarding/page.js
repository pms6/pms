"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Check, User, Briefcase, ShieldCheck, FileText, Users2, Wallet, Home,
  Mail, Phone, ChevronRight, ChevronLeft, Plus, X, Trash2, Loader2,
  Upload, CheckCircle2, XCircle, ExternalLink, Inbox, UserPlus, Ban,
} from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { ONBOARDING_STAGES, money } from "../_data/dummy";
import api from "../../api/api";
import { uploadFileToCloudinary } from "../../utils/uploadToCloudinary";
import LostReasonModal from "../../Shared/LostReasonModal";

const DOC_TYPES = [
  "ID / Passport",
  "Proof of income",
  "Bank statement",
  "Right to Rent",
  "Guarantor ID",
  "Tenancy agreement",
  "Reference",
  "Other",
];

// Rooms that can be offered to a new applicant.
const AVAILABLE_ROOM_STATUSES = ["AVAILABLE", "AVAILABLE_SOON"];

const STATUS_TONE = {
  verified: "green", passed: "green", approved: "green", protected: "green", complete: "green",
  pending: "amber", "n/a": "gray", not_required: "gray", not_started: "gray", "—": "gray",
  failed: "red",
};
function tone(s) { return STATUS_TONE[s] || "gray"; }
function initials(name) { return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(); }

function Stepper({ index, complete = false }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {ONBOARDING_STAGES.map((s, i) => {
        // Completing sets stageIndex to the last index, so without the
        // `complete` flag the final stage would render as "current" forever.
        const done = complete || i < index;
        const current = !complete && i === index;
        return (
          <div key={s} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1.5 w-20">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-[#F47C3C] text-white" : current ? "bg-[#0F253B] text-white ring-4 ring-[#0F253B]/10" : "bg-gray-100 text-gray-400"}`}>
                {done ? <Check size={15} /> : i + 1}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wide text-center leading-tight ${current ? "text-[#0F253B]" : "text-gray-400"}`}>{s}</span>
            </div>
            {i < ONBOARDING_STAGES.length - 1 && <div className={`h-0.5 w-4 ${done ? "bg-[#F47C3C]" : "bg-gray-100"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Section({ icon: Icon, title, children, action }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F47C3C] flex items-center justify-center"><Icon size={16} /></div>
          <h3 className="font-bold text-[#0F253B]">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-[#0F253B] mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

function NewOnboardingModal({ onClose, onCreated, properties }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", propertyId: "", roomId: "",
    rent: "", deposit: "", holdingDeposit: "", startDate: "", termMonths: "12",
  });
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (x) => Number(x) || 0;

  // When the property changes, load its rooms and reset the room selection.
  const onPropertyChange = async (e) => {
    const propertyId = e.target.value;
    setForm((f) => ({ ...f, propertyId, roomId: "" }));
    setRooms([]);
    if (!propertyId) return;
    setRoomsLoading(true);
    try {
      const res = await api.get(`/rooms/property/${propertyId}`);
      const all = res.data.data || [];
      // Only offer rooms that are actually lettable.
      setRooms(all.filter((r) => AVAILABLE_ROOM_STATUSES.includes(r.status)));
    } catch {
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  // Selecting a room auto-fills rent / deposit / holding from the room record.
  const onRoomChange = (e) => {
    const roomId = e.target.value;
    const room = rooms.find((r) => r._id === roomId);
    setForm((f) => ({
      ...f,
      roomId,
      rent: room?.monthlyRent != null ? String(room.monthlyRent) : f.rent,
      deposit: room?.securityDeposit != null ? String(room.securityDeposit) : f.deposit,
      holdingDeposit: room?.holdingDeposit != null ? String(room.holdingDeposit) : f.holdingDeposit,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Applicant name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const property = properties.find((p) => p._id === form.propertyId);
      const room = rooms.find((r) => r._id === form.roomId);
      const res = await api.post("/onboarding", {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        holdingDeposit: num(form.holdingDeposit),
        tenancy: {
          propertyId: form.propertyId || undefined,
          roomId: form.roomId || undefined,
          property: property?.name || "—",
          room: room?.roomName || room?.title || "—",
          rent: num(form.rent),
          frequency: "monthly",
          deposit: num(form.deposit),
          startDate: form.startDate,
          termMonths: num(form.termMonths) || 12,
        },
      });
      onCreated(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add applicant");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B] disabled:opacity-60 disabled:cursor-not-allowed";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";
  const roomLabel = (r) => {
    const name = r.roomName || r.title || "Room";
    const soon = r.status === "AVAILABLE_SOON" ? " · Available soon" : "";
    const rent = r.monthlyRent != null ? ` — £${r.monthlyRent}/mo` : "";
    return `${name}${rent}${soon}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">New Applicant</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">Applicant</p>
          <div><label className={labelCls}>Full Name</label><input className={field} value={form.name} onChange={set("name")} placeholder="Jane Doe" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Email</label><input type="email" className={field} value={form.email} onChange={set("email")} /></div>
            <div><label className={labelCls}>Phone</label><input className={field} value={form.phone} onChange={set("phone")} /></div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] pt-1">Tenancy</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Property</label>
              <select className={field} value={form.propertyId} onChange={onPropertyChange}>
                <option value="">Select…</option>
                {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Room {roomsLoading && <span className="text-gray-300 normal-case">· loading…</span>}
              </label>
              <select className={field} value={form.roomId} onChange={onRoomChange} disabled={!form.propertyId || roomsLoading}>
                <option value="">
                  {!form.propertyId
                    ? "Select a property first"
                    : roomsLoading
                    ? "Loading rooms…"
                    : rooms.length === 0
                    ? "No available rooms"
                    : "Select room…"}
                </option>
                {rooms.map((r) => <option key={r._id} value={r._id}>{roomLabel(r)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Monthly Rent (£)</label><input type="number" min="0" className={field} value={form.rent} onChange={set("rent")} placeholder="650" /></div>
            <div><label className={labelCls}>Deposit (£)</label><input type="number" min="0" className={field} value={form.deposit} onChange={set("deposit")} placeholder="750" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Holding (£)</label><input type="number" min="0" className={field} value={form.holdingDeposit} onChange={set("holdingDeposit")} placeholder="250" /></div>
            <div><label className={labelCls}>Start Date</label><input type="date" className={field} value={form.startDate} onChange={set("startDate")} /></div>
            <div><label className={labelCls}>Term (mo)</label><input type="number" min="0" className={field} value={form.termMonths} onChange={set("termMonths")} /></div>
          </div>

          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Adding…" : "Start Onboarding"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Documents card with PDF/image upload + verify workflow.
function DocumentsSection({ applicant, onApplicantUpdate }) {
  const fileRef = useRef(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const pick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url, publicId, name } = await uploadFileToCloudinary(file);
      const res = await api.post(`/onboarding/${applicant._id}/documents`, {
        name, type: docType, url, publicId,
      });
      onApplicantUpdate(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const verify = async (docId, status) => {
    setBusyId(docId);
    setError("");
    try {
      const res = await api.patch(`/onboarding/${applicant._id}/documents/${docId}/verify`, { status });
      onApplicantUpdate(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update document");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (docId, name) => {
    if (!confirm(`Delete document "${name}"?`)) return;
    setBusyId(docId);
    setError("");
    try {
      const res = await api.delete(`/onboarding/${applicant._id}/documents/${docId}`);
      onApplicantUpdate(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete document");
    } finally {
      setBusyId(null);
    }
  };

  const docs = applicant.documents || [];

  return (
    <Section
      icon={FileText}
      title="Documents"
      action={
        <div className="flex items-center gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-[#F47C3C] outline-none cursor-pointer"
          >
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={pick}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />
        </div>
      }
    >
      {error && <div className="mb-3 p-2.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
      {docs.length === 0 && <p className="text-sm text-gray-400 font-medium">No documents uploaded yet. Choose a type and upload a PDF or image.</p>}
      <ul className="grid grid-cols-1 gap-2">
        {docs.map((d) => (
          <li key={d._id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C] shrink-0"><FileText size={16} /></div>
            <div className="min-w-0 flex-1">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#0F253B] truncate flex items-center gap-1 hover:text-[#F47C3C]">
                {d.name} <ExternalLink size={12} className="shrink-0 opacity-60" />
              </a>
              <p className="text-[11px] text-gray-400 font-medium">{d.type || "Document"}</p>
            </div>
            <Badge tone={tone(d.status)}>{d.status}</Badge>
            <div className="flex items-center gap-1 shrink-0">
              {busyId === d._id ? (
                <Loader2 size={15} className="animate-spin text-gray-400" />
              ) : (
                <>
                  {d.status !== "verified" && (
                    <button onClick={() => verify(d._id, "verified")} title="Mark verified" className="text-gray-300 hover:text-emerald-600 transition-all"><CheckCircle2 size={16} /></button>
                  )}
                  {d.status !== "failed" && (
                    <button onClick={() => verify(d._id, "failed")} title="Mark rejected" className="text-gray-300 hover:text-red-600 transition-all"><XCircle size={16} /></button>
                  )}
                  <button onClick={() => remove(d._id, d.name)} title="Delete" className="text-gray-300 hover:text-red-600 transition-all"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default function AdminOnboarding() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [acceptingId, setAcceptingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);
  // The request the Cancel button is asking for a reason about.
  const [decliningRequest, setDecliningRequest] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [obRes, propsRes, reqRes] = await Promise.all([
        api.get("/onboarding"),
        api.get("/properties", { params: { limit: 100 } }),
        api.get("/onboarding/requests"),
      ]);
      const list = obRes.data.data || [];
      setItems(list);
      setProperties(propsRes.data.data || []);
      setRequests(reqRes.data.data || []);
      setSelectedId((cur) => cur && list.some((x) => x._id === cur) ? cur : list[0]?._id || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load onboarding");
    } finally {
      setLoading(false);
    }
  }, []);

  // Accept a website request → creates an onboarding applicant, connects the
  // tenant's account to this org, and emails them (all handled server-side).
  const acceptRequest = async (lead) => {
    setAcceptingId(lead._id);
    setError("");
    try {
      const res = await api.post("/onboarding/accept-request", { leadId: lead._id });
      const applicant = res.data.data?.applicant;
      setRequests((rs) => rs.filter((r) => r._id !== lead._id));
      if (applicant) {
        setItems((xs) => [applicant, ...xs]);
        setSelectedId(applicant._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to accept request");
    } finally {
      setAcceptingId(null);
    }
  };

  // Decline a website request → marks the lead lost (which drops it out of this
  // inbox) and emails the applicant. No onboarding is created and their account
  // is left alone. The reason is required by the server, the same rule the
  // Leads board applies when a lead is marked lost.
  const declineRequest = async (lead, reason) => {
    setDecliningId(lead._id);
    setError("");
    try {
      await api.post("/onboarding/decline-request", { leadId: lead._id, reason });
      setRequests((rs) => rs.filter((r) => r._id !== lead._id));
      setDecliningRequest(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to decline request");
    } finally {
      setDecliningId(null);
    }
  };

  useEffect(() => { load(); }, [load]);

  const a = items.find((x) => x._id === selectedId) || items[0];
  const lastStage = ONBOARDING_STAGES.length - 1;
  const progress = a ? Math.round((a.stageIndex / lastStage) * 100) : 0;

  // At the Referencing stage the applicant can only be advanced once at least
  // one document (uploaded by the tenant OR the admin) is on file.
  const REFERENCING_STAGE = ONBOARDING_STAGES.indexOf("Referencing");
  const needsDocsToAdvance =
    !!a && a.stageIndex === REFERENCING_STAGE && (a.documents?.length || 0) === 0;

  const created = (obj) => {
    setItems((xs) => [obj, ...xs]);
    setSelectedId(obj._id);
    setShowAdd(false);
  };

  // Replace an applicant in-place with a fresh copy returned by the API
  // (used after document upload / verify / delete).
  const replaceItem = (updated) => {
    setItems((xs) => xs.map((x) => (x._id === updated._id ? updated : x)));
  };

  const moveStage = async (delta) => {
    if (!a) return;
    // Block advancing past Referencing until a document has been uploaded.
    if (delta > 0 && needsDocsToAdvance) {
      alert("Upload at least one document (tenant or admin) before advancing past Referencing.");
      return;
    }
    const next = Math.min(lastStage, Math.max(0, a.stageIndex + delta));
    if (next === a.stageIndex) return;
    const prev = a.stageIndex;
    setSavingStage(true);
    setItems((xs) => xs.map((x) => (x._id === a._id ? { ...x, stageIndex: next } : x)));
    try {
      await api.patch(`/onboarding/${a._id}/stage`, { stageIndex: next });
    } catch (err) {
      setItems((xs) => xs.map((x) => (x._id === a._id ? { ...x, stageIndex: prev } : x)));
      alert(err.response?.data?.message || "Failed to update stage");
    } finally {
      setSavingStage(false);
    }
  };

  // Complete onboarding at the final (Move-in) stage: creates the tenancy on the
  // server so the tenant can access their room + details from the tenant portal.
  const completeApplicant = async () => {
    if (!a || a.completedAt) return;
    if (
      !confirm(
        `Complete onboarding for "${a.name}"?\n\nThis will:\n• Create their tenancy\n• Mark the room occupied\n• Email the tenant\n\nThis can't be undone from here.`
      )
    )
      return;
    setCompleting(true);
    try {
      const res = await api.patch(`/onboarding/${a._id}/complete`);
      replaceItem(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to complete onboarding");
    } finally {
      setCompleting(false);
    }
  };

  // Cancel an onboarding: soft-deletes it, frees the original request, and
  // disconnects the tenant from this org if this was their committed one.
  const cancelApplicant = async (applicant) => {
    if (!confirm(`Cancel onboarding for "${applicant.name}"? They'll be free to enquire again.`)) return;
    const snapshot = items;
    const nextList = items.filter((x) => x._id !== applicant._id);
    setItems(nextList);
    if (selectedId === applicant._id) setSelectedId(nextList[0]?._id || null);
    try {
      await api.patch(`/onboarding/${applicant._id}/cancel`);
    } catch (err) {
      setItems(snapshot);
      alert(err.response?.data?.message || "Failed to cancel onboarding");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Onboarding"
        subtitle="Move applicants from offer to move-in"
        action={
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> New Applicant
          </button>
        }
      />

      {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>}

      {/* Pending requests — website enquiries awaiting acceptance */}
      {requests.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F47C3C] flex items-center justify-center"><Inbox size={16} /></div>
            <h3 className="font-bold text-[#0F253B]">Pending Requests</h3>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-[#F47C3C] text-white text-[11px] font-bold">{requests.length}</span>
            <span className="ml-auto text-[11px] font-medium text-gray-400">New viewing requests from your listings</span>
          </div>
          <ul className="divide-y divide-gray-50">
            {requests.map((r) => (
              <li key={r._id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-10 h-10 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-sm font-bold shrink-0">{initials(r.name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0F253B] text-sm truncate">{r.name}</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate flex flex-wrap gap-x-3">
                    <span className="flex items-center gap-1"><Home size={11} />{r.interestedIn || "—"}</span>
                    {r.email && <span className="flex items-center gap-1"><Mail size={11} />{r.email}</span>}
                    {r.phone && <span className="flex items-center gap-1"><Phone size={11} />{r.phone}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => acceptRequest(r)}
                    disabled={acceptingId === r._id || decliningId === r._id}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                  >
                    {acceptingId === r._id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    {acceptingId === r._id ? "Accepting…" : "Accept"}
                  </button>
                  <button
                    onClick={() => setDecliningRequest(r)}
                    disabled={acceptingId === r._id || decliningId === r._id}
                    title="Decline this request"
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-[#0F253B] font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                  >
                    {decliningId === r._id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    {decliningId === r._id ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Counts key off completedAt, not stageIndex alone — a completed
            applicant sits at the last stage and would otherwise still be
            counted as "ready to move-in". */}
        {[
          {
            label: "In progress",
            value: items.filter((o) => !o.completedAt && o.stageIndex < lastStage).length,
          },
          {
            label: "Ready to complete",
            value: items.filter((o) => !o.completedAt && o.stageIndex === lastStage).length,
          },
          { label: "Completed", value: items.filter((o) => o.completedAt).length },
          { label: "Total applicants", value: items.length },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 bg-white border border-gray-100 rounded-2xl">
          <p className="text-sm font-semibold text-gray-400">No applicants in onboarding yet.</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all">
            <Plus size={18} /> New Applicant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Master list */}
          <div className="lg:col-span-1 space-y-2">
            {items.map((o) => {
              const p = Math.round((o.stageIndex / lastStage) * 100);
              const active = o._id === selectedId;
              return (
                <button key={o._id} onClick={() => setSelectedId(o._id)} className={`w-full text-left bg-white border rounded-2xl p-4 transition-all ${active ? "border-[#F47C3C] ring-2 ring-[#F47C3C]/20" : "border-gray-100 hover:shadow-md"}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-sm font-bold shrink-0">{initials(o.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0F253B] text-sm truncate">{o.name}</p>
                      <p className="text-[11px] text-gray-400 font-medium truncate">{o.tenancy?.property} · {o.tenancy?.room}</p>
                    </div>
                    <ChevronRight size={16} className={active ? "text-[#F47C3C]" : "text-gray-300"} />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                      <span className="text-gray-400 uppercase tracking-widest">{ONBOARDING_STAGES[o.stageIndex]}</span>
                      <span className="text-[#0F253B]">{p}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-[#F47C3C]" style={{ width: `${p}%` }} /></div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          {a && (
            <div className="lg:col-span-2 space-y-4">
              {/* Header + stepper */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#0F253B] text-white flex items-center justify-center font-bold">{initials(a.name)}</div>
                    <div>
                      <h2 className="text-lg font-bold text-[#0F253B]">{a.name}</h2>
                      <p className="text-xs text-gray-400 font-medium flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1"><Mail size={11} />{a.email || "—"}</span>
                        <span className="flex items-center gap-1"><Phone size={11} />{a.phone || "—"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.completedAt ? (
                      <Badge tone="green">Completed</Badge>
                    ) : a.stageIndex === lastStage ? (
                      // Reaching the last stage is NOT completion — the tenancy
                      // is only created when the button below is pressed. This
                      // used to read a green "100% complete", which contradicted
                      // the "Complete Onboarding" button sitting next to it.
                      <Badge tone="amber">Ready to complete</Badge>
                    ) : (
                      <Badge tone="orange">{progress}% complete</Badge>
                    )}
                    {!a.completedAt && (
                      <button
                        onClick={() => cancelApplicant(a)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                      >
                        <Ban size={14} /> Cancel Onboarding
                      </button>
                    )}
                  </div>
                </div>
                <Stepper index={a.stageIndex} complete={!!a.completedAt} />
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                  <button
                    onClick={() => moveStage(-1)}
                    disabled={savingStage || completing || a.stageIndex === 0 || !!a.completedAt}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    {a.completedAt
                      ? "All stages complete"
                      : `Stage ${a.stageIndex + 1} / ${ONBOARDING_STAGES.length} · ${ONBOARDING_STAGES[a.stageIndex]}`}
                  </span>
                  {a.completedAt ? (
                    <span className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl">
                      <CheckCircle2 size={15} /> Tenancy Created
                    </span>
                  ) : a.stageIndex === lastStage ? (
                    <button
                      onClick={completeApplicant}
                      disabled={completing}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {completing ? (
                        <><Loader2 size={15} className="animate-spin" /> Creating tenancy…</>
                      ) : (
                        <><CheckCircle2 size={15} /> Complete &amp; Create Tenancy</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => moveStage(1)}
                      disabled={savingStage || needsDocsToAdvance}
                      title={needsDocsToAdvance ? "Upload at least one document to advance past Referencing" : undefined}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#F47C3C] hover:bg-[#e06d30] rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingStage ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <>Advance to {ONBOARDING_STAGES[a.stageIndex + 1]} <ChevronRight size={15} /></>
                      )}
                    </button>
                  )}
                </div>

                {/* Say what the button will actually do, so "complete" is never
                    mistaken for "already complete". */}
                {a.completedAt ? (
                  <p className="mt-3 text-center text-[11px] font-semibold text-emerald-700">
                    Completed {new Date(a.completedAt).toLocaleDateString("en-GB")} — the tenancy is
                    active and the room is marked occupied. The tenant now sees every stage as done.
                  </p>
                ) : a.stageIndex === lastStage && !needsDocsToAdvance ? (
                  <p className="mt-3 text-center text-[11px] font-semibold text-gray-500">
                    Final step. This creates the tenancy, marks the room occupied and emails the
                    tenant. It can&apos;t be undone from here.
                  </p>
                ) : null}

                {needsDocsToAdvance && (
                  <p className="mt-3 text-center text-[11px] font-semibold text-amber-600">
                    Upload at least one document (tenant or admin) below to advance past Referencing.
                  </p>
                )}
              </div>

              {/* Tenancy terms */}
              <Section icon={Home} title="Tenancy Terms">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Property" value={a.tenancy?.property} />
                  <Field label="Room" value={a.tenancy?.room} />
                  <Field label="Rent" value={a.tenancy?.rent ? `${money(a.tenancy.rent)}/mo` : "—"} />
                  <Field label="Deposit" value={a.tenancy?.deposit ? money(a.tenancy.deposit) : "—"} />
                  <Field label="Start date" value={a.tenancy?.startDate} />
                  <Field label="Term" value={a.tenancy?.termMonths ? `${a.tenancy.termMonths} months` : "—"} />
                  <Field label="Frequency" value={a.tenancy?.frequency} />
                  <Field label="Holding deposit" value={a.holdingDeposit ? money(a.holdingDeposit) : "—"} />
                </div>
              </Section>

              {/* Personal */}
              <Section icon={User} title="Personal Details">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Date of birth" value={a.dob} />
                  <Field label="Nationality" value={a.nationality} />
                  <Field label="Current address" value={a.currentAddress} />
                </div>
              </Section>

              {/* Employment */}
              <Section icon={Briefcase} title="Employment & Affordability">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Employer" value={a.employment?.employer} />
                  <Field label="Job title" value={a.employment?.jobTitle} />
                  <Field label="Type" value={a.employment?.type} />
                  <Field label="Annual income" value={a.employment?.annualIncome ? money(a.employment.annualIncome) : "—"} />
                  <Field label="Started" value={a.employment?.startDate} />
                  <Field label="Rent : income" value={`${a.employment?.annualIncome ? Math.round((a.tenancy?.rent * 12 / a.employment.annualIncome) * 100) : 0}%`} />
                </div>
              </Section>

              {/* Right to Rent */}
              <Section icon={ShieldCheck} title="Right to Rent" action={<Badge tone={tone(a.rightToRent?.status)}>{a.rightToRent?.status || "pending"}</Badge>}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Field label="Document" value={a.rightToRent?.docType} />
                  <Field label="Number" value={a.rightToRent?.docNumber} />
                  <Field label="Expiry" value={a.rightToRent?.expiry} />
                  <Field label="Share code" value={a.rightToRent?.shareCode} />
                </div>
              </Section>

              {/* References */}
              <Section icon={FileText} title="References">
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "Previous landlord", v: a.references?.previousLandlord },
                    { label: "Employer", v: a.references?.employer },
                    { label: "Credit check", v: a.references?.credit },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50">
                      <span className="text-xs font-semibold text-[#0F253B]">{r.label}</span>
                      <Badge tone={tone(r.v)}>{r.v || "pending"}</Badge>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Guarantor */}
              <Section icon={Users2} title="Guarantor" action={<Badge tone={tone(a.guarantor?.status)}>{(a.guarantor?.status || "not_required").replace("_", " ")}</Badge>}>
                {(!a.guarantor || a.guarantor.status === "not_required") ? (
                  <p className="text-sm text-gray-400 font-medium">Not required — applicant meets affordability criteria.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Name" value={a.guarantor.name} />
                    <Field label="Relationship" value={a.guarantor.relationship} />
                    <Field label="Annual income" value={a.guarantor.annualIncome ? money(a.guarantor.annualIncome) : "—"} />
                    <Field label="Address" value={a.guarantor.address} />
                    <Field label="Phone" value={a.guarantor.phone} />
                  </div>
                )}
              </Section>

              {/* Deposit */}
              <Section icon={Wallet} title="Deposit Protection" action={<Badge tone={tone(a.depositScheme?.status)}>{(a.depositScheme?.status || "not_started").replace("_", " ")}</Badge>}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Scheme" value={a.depositScheme?.provider} />
                  <Field label="Amount" value={a.tenancy?.deposit ? money(a.tenancy.deposit) : "—"} />
                  <Field label="Reference" value={a.depositScheme?.ref} />
                </div>
              </Section>

              {/* Documents — upload + verify workflow */}
              <DocumentsSection applicant={a} onApplicantUpdate={replaceItem} />
            </div>
          )}
        </div>
      )}

      {showAdd && <NewOnboardingModal properties={properties} onClose={() => setShowAdd(false)} onCreated={created} />}

      {/* Declining a request marks its lead lost, and the server requires a
          reason — the same modal the Leads boards use for that. */}
      {decliningRequest && (
        <LostReasonModal
          lead={decliningRequest}
          onCancel={() => setDecliningRequest(null)}
          onConfirm={(reason) => declineRequest(decliningRequest, reason)}
        />
      )}
    </div>
  );
}
