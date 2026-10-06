"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Trash2, ShieldCheck, Check, Search, Loader2 } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import api from "../../api/api";
import { guardModalClose } from "@/app/Shared/modalGuard";

const STATUSES = ["Protection Pending", "Protected", "Release Requested", "Payment Received"];
const STATUS_TONE = { "Protection Pending": "amber", Protected: "green", "Release Requested": "blue", "Payment Received": "gray" };
const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";
const blank = () => ({ tenant: "", email: "", phone: "", property: "", room: "", amount: "", status: "Protection Pending", paymentReceived: false, note: "" });
const effectiveStatus = (row) => ({ "Protect ASAP": "Protection Pending", Released: "Release Requested" }[row.status] || row.status || "Protection Pending");
const isPaymentReceived = (row) => Boolean(row.paymentReceived || row.status === "Payment Received");
const roomLabel = (room) => `${room.roomName || room.title || "Room"}${room.roomNumber ? ` · ${room.roomNumber}` : ""}`;

function DepositProtectionForm({ initial, properties, onClose, onSave }) {
  const [form, setForm] = useState(() => initial ? { ...blank(), ...initial, status: effectiveStatus(initial), amount: initial.amount ?? "", paymentReceived: isPaymentReceived(initial) } : blank());
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const loadRooms = useCallback(async (propertyId) => {
    if (!propertyId) { setRooms([]); return; }
    setRoomsLoading(true);
    try { const res = await api.get(`/rooms/property/${propertyId}`); setRooms(res.data?.data || []); }
    catch { setRooms([]); }
    finally { setRoomsLoading(false); }
  }, []);
  useEffect(() => { if (initial?.propertyId) loadRooms(initial.propertyId); }, [initial?.propertyId, loadRooms]);
  const changeProperty = (e) => {
    const propertyId = e.target.value;
    const property = properties.find((item) => String(item._id) === propertyId);
    setForm((current) => ({ ...current, propertyId, property: property?.name || "", roomId: "", room: "" }));
    setRooms([]);
    loadRooms(propertyId);
  };
  const changeRoom = (e) => {
    const roomId = e.target.value;
    const room = rooms.find((item) => String(item._id) === roomId);
    setForm((current) => ({ ...current, roomId, room: room ? roomLabel(room) : "" }));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.tenant.trim()) return setError("Tenant name is required.");
    setSaving(true); setError("");
    try { await onSave({ ...form, tenant: form.tenant.trim(), propertyId: form.propertyId || null, roomId: form.roomId || null, amount: form.amount === "" ? null : Number(form.amount) }, initial?._id); onClose(); }
    catch (err) { setError(err.response?.data?.message || "Could not save this record."); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
    <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold text-[#0F253B]">{initial ? "Edit Deposit Record" : "New Deposit Record"}</h2><p className="mt-1 text-xs font-medium text-gray-400">Tenant and protection details</p></div><button type="button" onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-gray-600"><X size={20}/></button></div>
      {error && <p role="alert" className="mb-4 rounded-xl border-l-4 border-red-500 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL}>Tenant name *</label><input className={FIELD} value={form.tenant} onChange={set("tenant")} required autoFocus /></div><div><label className={LABEL}>Deposit amount (£)</label><input type="number" min="0" step="0.01" className={FIELD} value={form.amount} onChange={set("amount")} /></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL}>Email</label><input type="email" className={FIELD} value={form.email} onChange={set("email")} /></div><div><label className={LABEL}>Contact number</label><input className={FIELD} value={form.phone} onChange={set("phone")} /></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL}>Property</label><select className={FIELD} value={form.propertyId || ""} onChange={changeProperty}><option value="">Select property</option>{properties.map((property) => <option key={property._id} value={property._id}>{property.name}</option>)}</select>{form.property && !form.propertyId && <p className="mt-1 text-[11px] text-gray-400">Existing property: {form.property}. Choose a property to link this record.</p>}</div><div><label className={LABEL}>Room / Area</label><select className={FIELD} value={form.roomId || ""} onChange={changeRoom} disabled={!form.propertyId || roomsLoading}><option value="">{roomsLoading ? "Loading rooms…" : !form.propertyId ? "Select a property first" : "Whole property / communal"}</option>{rooms.map((room) => <option key={room._id} value={room._id}>{roomLabel(room)}</option>)}</select>{form.room && !form.roomId && <p className="mt-1 text-[11px] text-gray-400">Existing room: {form.room}. Choose a room to link this record.</p>}</div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL}>Protection status</label><select className={FIELD} value={form.status} onChange={set("status")}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"><input type="checkbox" className="h-4 w-4 accent-[#F47C3C]" checked={form.paymentReceived} onChange={(e) => setForm((current) => ({ ...current, paymentReceived: e.target.checked }))}/><span><span className="block text-sm font-bold text-[#0F253B]">Payment received</span><span className="block text-[11px] font-medium text-gray-400">Tick when received; untick to reverse</span></span></label></div>
        <div><label className={LABEL}>Notes</label><textarea rows={3} className={FIELD} value={form.note} onChange={set("note")} placeholder="Add any deposit protection notes" /></div>
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className="rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-bold text-[#0F253B] hover:bg-gray-50">Cancel</button><button disabled={saving} className="rounded-xl bg-[#F47C3C] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : initial ? "Save changes" : "Add deposit"}</button></div>
      </form>
    </div>
  </div>;
}

function StatusSection({ title, status, rows, busyId, onEdit, onDelete, onStatus, onPaid }) {
  return <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-[#0F253B]">{title}</h2><Badge tone={STATUS_TONE[status]}>{rows.length} {rows.length === 1 ? "record" : "records"}</Badge></div>
    {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-gray-400">No {title.toLowerCase()} records.</p> : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map((row) => {
      const paid = isPaymentReceived(row);
      return <article key={row._id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onEdit(row)} className="min-w-0 text-left"><h3 className="truncate font-bold text-[#0F253B] hover:text-[#F47C3C]">{row.tenant}</h3><p className="mt-1 truncate text-xs font-medium text-gray-500">{[row.property, row.room].filter(Boolean).join(" · ") || "No property recorded"}</p></button><button type="button" disabled={busyId === row._id} onClick={() => onDelete(row)} aria-label={`Delete ${row.tenant}`} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"><Trash2 size={15}/></button></div>
        {(row.email || row.phone) && <p className="mt-2 text-xs text-gray-500">{[row.email, row.phone].filter(Boolean).join(" · ")}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3"><div><p className={LABEL}>Deposit</p><p className="text-sm font-bold text-[#0F253B]">{row.amount == null ? "—" : `£${Number(row.amount).toFixed(2)}`}</p></div><div><p className={LABEL}>Status</p><select disabled={busyId === row._id} aria-label={`Protection status for ${row.tenant}`} value={effectiveStatus(row)} onChange={(e) => onStatus(row, e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div></div>
        <label className={`mt-3 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${paid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-100 bg-gray-50 text-gray-500"}`}><input type="checkbox" disabled={busyId === row._id} checked={paid} onChange={(e) => onPaid(row, e.target.checked)} className="h-4 w-4 accent-emerald-600 disabled:opacity-40"/><span className="flex items-center gap-1.5">{paid && <Check size={14}/>}Payment received</span><span className="ml-auto">{paid ? "Yes" : "No"}</span></label>
        {row.note && <p className="mt-3 whitespace-pre-wrap text-xs text-gray-500">{row.note}</p>}
      </article>;
    })}</div>}
  </section>;
}

export default function DepositProtectionPage() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState("");
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState(""); const [modal, setModal] = useState(null); const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const res = await api.get("/deposit-protection"); setRows(res.data?.data || []); } catch (err) { setError(err.response?.data?.message || "Could not load deposit protection records."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { (async () => { try { const res = await api.get("/properties", { params: { limit: 1000 } }); setProperties(res.data?.data || res.data || []); } catch { setProperties([]); } })(); }, []);
  const save = async (payload, id) => { const res = id ? await api.put(`/deposit-protection/${id}`, payload) : await api.post("/deposit-protection", payload); const saved = res.data.data; setRows((current) => id ? current.map((row) => row._id === id ? saved : row) : [saved, ...current]); };
  const patch = async (row, data) => { setBusyId(row._id); setError(""); try { const res = await api.put(`/deposit-protection/${row._id}`, data); setRows((current) => current.map((item) => item._id === row._id ? res.data.data : item)); } catch (err) { setError(err.response?.data?.message || "Could not update this record."); } finally { setBusyId(""); } };
  const remove = async (row) => { if (!window.confirm(`Delete the deposit protection record for ${row.tenant}?`)) return; setBusyId(row._id); setError(""); try { await api.delete(`/deposit-protection/${row._id}`); setRows((current) => current.filter((item) => item._id !== row._id)); } catch (err) { setError(err.response?.data?.message || "Could not delete this record."); } finally { setBusyId(""); } };
  const visible = useMemo(() => rows.filter((row) => { const text = `${row.tenant} ${row.email} ${row.phone} ${row.property} ${row.room}`.toLowerCase(); const status = effectiveStatus(row); const matchesFilter = filter === "payment_received" ? Boolean(row.paymentReceived || row.status === "Payment Received") : (!filter || status === filter); return matchesFilter && (!query.trim() || text.includes(query.trim().toLowerCase())); }), [rows, filter, query]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => effectiveStatus(r) === s).length])), [rows]);
  const paidCount = rows.filter(isPaymentReceived).length;
  return <div className="space-y-5">
    <PageHeader title="Deposit Protection" subtitle="Track protected, outstanding and released tenant deposits" action={<button onClick={() => setModal({})} className="flex items-center gap-2 rounded-xl bg-[#F47C3C] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e06d30]"><Plus size={18}/>New Record</button>} />
    {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}<button onClick={load} className="ml-3 rounded-lg bg-red-100 px-3 py-1 text-xs font-bold">Retry</button></div>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{[{label:"Total Deposits",value:rows.length,filterValue:""},{label:"Protection Pending",value:counts["Protection Pending"]||0,filterValue:"Protection Pending"},{label:"Protected",value:counts.Protected||0,filterValue:"Protected"},{label:"Release Requested",value:counts["Release Requested"]||0,filterValue:"Release Requested"},{label:"Payment Received",value:`${paidCount} / ${rows.length}`,filterValue:"payment_received"}].map((card)=><button type="button" key={card.label} onClick={()=>setFilter(filter===card.filterValue?"":card.filterValue)} className={`rounded-2xl border p-4 text-left ${filter===card.filterValue&&filter!==""?"border-[#F47C3C] bg-orange-50":"border-gray-100 bg-white"}`}><p className="text-2xl font-bold text-[#0F253B]">{loading?"—":card.value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{card.label}</p></button>)}</div>
    <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"/><input aria-label="Search deposit records" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search tenant, property or contact…" className="w-full rounded-xl border border-gray-100 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#F47C3C]"/></div><div className="flex flex-wrap gap-2">{["",...STATUSES,"payment_received"].map((s)=><button key={s||"all"} onClick={()=>setFilter(s)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${filter===s?"border-[#0F253B] bg-[#0F253B] text-white":"border-gray-100 bg-white text-gray-500 hover:bg-gray-50"}`}>{s==="payment_received"?"Payment Received":s||"All statuses"}</button>)}</div></div>
    {loading?<div className="flex h-48 items-center justify-center rounded-2xl border border-gray-100 bg-white"><Loader2 className="animate-spin text-[#F47C3C]"/></div>:<div className="space-y-5">{STATUSES.map((status)=><StatusSection key={status} title={status} status={status} rows={visible.filter((row)=>effectiveStatus(row)===status)} busyId={busyId} onEdit={setModal} onDelete={remove} onStatus={(row,value)=>patch(row,{status:value,paymentReceived:value==="Payment Received"?true:Boolean(row.paymentReceived || row.status==="Payment Received")})} onPaid={(row,value)=>patch(row,{paymentReceived:value,status:!value&&row.status==="Payment Received"?"Protected":effectiveStatus(row)})} />)}</div>}
    {!loading && visible.length===0 && rows.length>0 && <p className="rounded-2xl border border-gray-100 bg-white py-10 text-center text-sm text-gray-400">No deposit records match your search.</p>}
    {!loading && rows.length===0 && <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center"><ShieldCheck size={28} className="mx-auto mb-2 text-[#F47C3C]"/><p className="font-bold text-[#0F253B]">No deposit records yet</p><p className="mt-1 text-sm text-gray-400">Add a record to start tracking deposit protection.</p></div>}
    {modal!==null && <DepositProtectionForm initial={modal?._id?modal:null} properties={properties} onClose={()=>setModal(null)} onSave={save}/>}
  </div>;
}
