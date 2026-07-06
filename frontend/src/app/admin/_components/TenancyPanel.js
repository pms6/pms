"use client";

import { useState } from "react";
import {
  X, Pencil, PoundSterling, CalendarDays, DoorOpen, MessageSquare, UserPlus,
  Mail, Phone, ShieldCheck, FileText, Check, Clock, Filter, Plus, Ban, Building2, Send, ChevronRight,
} from "lucide-react";
import { Badge } from "../../Shared/ui";
import RentCollectionPanel from "./RentCollectionPanel";
import { tenants, money } from "../_data/dummy";

const INTERESTS = ["Fitness", "Cooking", "Live music", "Cycling", "Films", "Travel"];

const COMMS = [
  { from: "you", who: "Ella Moore", text: "Hi! Just confirming your move-in is all set for the 5th. Let me know if you need anything.", time: "2 days ago" },
  { from: "tenant", who: "Tenant", text: "Thanks Ella — all good. Could you share the Wi-Fi details?", time: "1 day ago" },
  { from: "you", who: "Ella Moore", text: "Sent them in the Welcome Pack 👍", time: "22 hours ago" },
];

const DOCS = [
  { name: "Tenancy Contract", shared: "2026-07-05", ack: true },
  { name: "Electrical Installation Condition Report (EICR)", shared: "2026-07-05", ack: true },
  { name: "Energy Performance Certificate (EPC)", shared: "2026-07-05", ack: false },
  { name: "Gas Safety Certificate", shared: "2026-07-05", ack: true },
  { name: "How to Rent Guide", shared: "2026-07-05", ack: false },
];

const AUDIT = [
  { date: "2026-07-06", category: "Communication", who: "Ella Moore", note: "Shared Welcome Pack with tenant." },
  { date: "2026-07-05", category: "Tenancy", who: "System", note: "Tenancy activated · move-in recorded." },
  { date: "2026-07-05", category: "Document", who: "Ella Moore", note: "Tenancy Contract acknowledged by tenant." },
  { date: "2026-06-28", category: "Finance", who: "Priya Shah", note: "Deposit protected with DPS." },
];

const AUDIT_CATEGORIES = ["All", "Tenancy", "Finance", "Communication", "Document"];
const TEAM = ["All", "Ella Moore", "Sam Reed", "Priya Shah", "System"];
const COMM_TABS = ["Messages", "Archived", "Notices", "Documents", "Reports"];

function Section({ icon: Icon, title, action, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B] disabled:opacity-60";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

export default function TenancyPanel({ tenancy, propertyName, onClose }) {
  const { tenant, unit, rent } = tenancy;
  const reg = tenants.find((t) => t.name === tenant) || {};
  const [forename, ...rest] = tenant.split(" ");
  const surname = rest.join(" ");
  const cohoLinked = true; // demo: personal details managed by tenant's COHO account
  const [commTab, setCommTab] = useState("Messages");
  const [auditCat, setAuditCat] = useState("All");
  const [auditWho, setAuditWho] = useState("All");
  const [note, setNote] = useState("");
  const [showRent, setShowRent] = useState(false);

  const initials = tenant.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const audit = AUDIT.filter((a) => (auditCat === "All" || a.category === auditCat) && (auditWho === "All" || a.who === auditWho));

  const act = (label) => () => alert(`${label} (demo)`);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-3xl bg-[#F8FAFC] h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Tenancy</p>
            <h2 className="text-lg font-bold text-[#0F253B]">{tenant} · {unit}</h2>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={22} /></button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Status + actions */}
          <div className="bg-gradient-to-r from-[#0F253B] to-[#1c3e5e] text-white rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <Badge tone="green">Active</Badge>
                <p className="text-sm text-white/70 mt-2">{propertyName} · {unit} · {money(rent)}/mo</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
                  <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-[#F47C3C]" />Move-in <b>5 Jul 2026</b></span>
                  <span className="flex items-center gap-1.5"><Clock size={14} className="text-[#F47C3C]" />Becomes periodic <b>5 Jul 2027</b></span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { label: "Edit Tenancy", icon: Pencil },
                { label: "Change Rent", icon: PoundSterling },
                { label: "Set Tenancy End Date", icon: CalendarDays },
                { label: "Change Room", icon: DoorOpen },
              ].map((b) => (
                <button key={b.label} onClick={act(b.label)} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all">
                  <b.icon size={14} /> {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tenant Information */}
          <Section
            icon={UserPlus}
            title="Tenant Information"
            action={
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowRent(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F253B] hover:bg-[#1c3e5e] text-white text-xs font-bold rounded-lg"><PoundSterling size={13} /> Rent Collection</button>
                <button onClick={act("Message")} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white text-xs font-bold rounded-lg"><MessageSquare size={13} /> Message</button>
                <button onClick={act("Add a Tenant")} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 text-[#0F253B] text-xs font-bold rounded-lg"><UserPlus size={13} /> Add Tenant</button>
              </div>
            }
          >
            <div className="flex gap-4 flex-wrap">
              <div className="w-20 h-20 rounded-2xl bg-[#0F253B] text-white flex items-center justify-center text-2xl font-bold shrink-0">{initials}</div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-lg font-bold text-[#0F253B]">{tenant}</p>
                <p className="text-sm text-gray-400 font-medium">29 · Professional</p>
                <p className="text-sm text-gray-500 mt-2 italic">“Easy-going professional, tidy, work in tech and enjoy a quiet house during the week.”</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {INTERESTS.map((i) => <span key={i} className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">{i}</span>)}
                </div>
              </div>
            </div>
          </Section>

          {/* Tenant details */}
          <Section icon={FileText} title="Tenant Details">
            {cohoLinked && (
              <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-blue-700 text-xs font-semibold rounded flex items-center gap-2">
                <ShieldCheck size={14} /> Linked COHO account — personal details are managed by the tenant and can't be edited here.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={LABEL}>Forename</label><input className={FIELD} defaultValue={forename} disabled={cohoLinked} /></div>
              <div><label className={LABEL}>Surname</label><input className={FIELD} defaultValue={surname} disabled={cohoLinked} /></div>
              <div><label className={LABEL}>Email Address</label><input className={FIELD} defaultValue={reg.email || ""} disabled={cohoLinked} /></div>
              <div><label className={LABEL}>Phone Number</label><input className={FIELD} defaultValue={reg.phone || ""} disabled={cohoLinked} /></div>
              <div><label className={LABEL}>Date of Birth</label><input type="date" className={FIELD} defaultValue="1997-03-14" disabled={cohoLinked} /></div>
              <div><label className={LABEL}>Gender</label><input className={FIELD} defaultValue="Prefer not to say" disabled={cohoLinked} /></div>
              <div><label className={LABEL}>National Insurance No.</label><input className={FIELD} defaultValue="QQ 12 34 56 C" disabled={cohoLinked} /></div>
              <div><label className={LABEL}>Next of Kin</label><input className={FIELD} defaultValue="—" disabled={cohoLinked} /></div>
              <div className="sm:col-span-2"><label className={LABEL}>Custom Fields</label><input className={FIELD} placeholder="e.g. Parking permit ref" disabled={cohoLinked} /></div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={act("Convert to Company Account")} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 text-[#0F253B] text-xs font-bold rounded-lg"><Building2 size={13} /> Convert to Company Account</button>
              <button onClick={act("View Previous Conversations")} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 text-[#0F253B] text-xs font-bold rounded-lg"><MessageSquare size={13} /> Previous Conversations</button>
              <button onClick={act("Revoke Tenant Portal Access")} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg"><Ban size={13} /> Revoke Portal Access</button>
            </div>
          </Section>

          {/* Guarantor */}
          <Section icon={ShieldCheck} title="Guarantor Information" action={<Badge tone="green">Approved</Badge>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[["Name", "R. Patel"], ["Relationship", "Parent"], ["Annual Income", "£52,000"], ["Phone", "07700 900901"]].map(([k, v]) => (
                <div key={k}><p className={LABEL}>{k}</p><p className="text-sm font-bold text-[#0F253B]">{v}</p></div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-3 py-1">Public card · Emergency contact</span>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-3 py-1">Private card · Reference on file</span>
            </div>
          </Section>

          {/* Communications */}
          <Section
            icon={MessageSquare}
            title="Communications"
            action={<button onClick={act("New Message")} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white text-xs font-bold rounded-lg"><Plus size={13} /> New Message</button>}
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {COMM_TABS.map((t) => (
                <button key={t} onClick={() => setCommTab(t)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${commTab === t ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>{t}</button>
              ))}
            </div>
            {commTab === "Messages" ? (
              <ul className="space-y-2">
                {COMMS.map((m, i) => (
                  <li key={i} className={`p-3 rounded-xl max-w-[85%] ${m.from === "you" ? "bg-orange-50 ml-auto" : "bg-gray-50"}`}>
                    <p className="text-sm text-[#0F253B]">{m.text}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-1">{m.who} · {m.time}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 font-medium py-4 text-center">No {commTab.toLowerCase()} yet.</p>
            )}
          </Section>

          {/* Documents */}
          <Section icon={FileText} title="Documents">
            <ul className="space-y-2">
              {DOCS.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C] shrink-0"><FileText size={16} /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F253B] truncate">{d.name}</p>
                      <p className="text-[11px] text-gray-400 font-medium">Shared {new Date(d.shared).toLocaleDateString("en-GB")}</p>
                    </div>
                  </div>
                  {d.ack
                    ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 shrink-0"><Check size={13} /> Acknowledged</span>
                    : <span className="text-[11px] font-bold text-amber-600 shrink-0">Awaiting</span>}
                </li>
              ))}
            </ul>
          </Section>

          {/* Audit Log */}
          <Section
            icon={Clock}
            title="Audit Log"
            action={
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-300" />
                <select value={auditCat} onChange={(e) => setAuditCat(e.target.value)} className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold text-[#0F253B]">
                  {AUDIT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={auditWho} onChange={(e) => setAuditWho(e.target.value)} className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold text-[#0F253B]">
                  {TEAM.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            }
          >
            {/* Add manual note */}
            <div className="flex gap-2 mb-4">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a manual note…" className={FIELD} />
              <button onClick={() => { if (note.trim()) { alert("Note added (demo)"); setNote(""); } }} className="px-3 rounded-xl bg-[#0F253B] text-white text-sm font-bold shrink-0">Add</button>
            </div>
            <ul className="space-y-2">
              {audit.length === 0 ? (
                <li className="text-sm text-gray-400 font-medium py-3 text-center">No log entries for these filters.</li>
              ) : audit.map((a, i) => (
                <li key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-[11px] font-bold text-gray-400 w-20 shrink-0">{new Date(a.date).toLocaleDateString("en-GB")}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-[#0F253B]">{a.note}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5"><Badge tone="gray">{a.category}</Badge> <span className="ml-1">{a.who}</span></p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-[#0F253B] font-bold rounded-xl transition-all">Close Tenancy Panel</button>
        </div>
      </div>

      {showRent && (
        <RentCollectionPanel
          charge={{ tenant, property: propertyName, room: unit, amount: rent, method: "Direct Debit", status: "due", paidDate: null }}
          onClose={() => setShowRent(false)}
        />
      )}
    </div>
  );
}
