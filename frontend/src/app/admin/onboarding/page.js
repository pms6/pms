"use client";

import { useState } from "react";
import {
  Check, User, Briefcase, ShieldCheck, FileText, Users2, Wallet, Home,
  Mail, Phone, ChevronRight, Plus, X,
} from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { onboarding, ONBOARDING_STAGES, properties, money } from "../_data/dummy";

const STATUS_TONE = {
  verified: "green", passed: "green", approved: "green", protected: "green", complete: "green",
  pending: "amber", "n/a": "gray", not_required: "gray", not_started: "gray", "—": "gray",
  failed: "red",
};
function tone(s) { return STATUS_TONE[s] || "gray"; }
function initials(name) { return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(); }

function Stepper({ index }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {ONBOARDING_STAGES.map((s, i) => {
        const done = i < index;
        const current = i === index;
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

function NewOnboardingModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", property: "", room: "",
    rent: "", deposit: "", holdingDeposit: "", startDate: "", termMonths: "12",
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const num = (x) => Number(x) || 0;

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Applicant name is required"); return; }
    onCreate({
      id: `o${Date.now()}`,
      name: form.name, avatarSeed: form.name, email: form.email, phone: form.phone,
      dob: "", nationality: "", currentAddress: "",
      stageIndex: 0,
      holdingDeposit: num(form.holdingDeposit),
      employment: { employer: "", jobTitle: "", type: "", annualIncome: 0, startDate: "" },
      rightToRent: { status: "pending", docType: "", docNumber: "", expiry: "", shareCode: "" },
      references: { previousLandlord: "pending", employer: "pending", credit: "pending" },
      guarantor: { name: "", relationship: "", annualIncome: 0, address: "", phone: "", status: "not_required" },
      tenancy: { property: form.property || "—", room: form.room || "—", rent: num(form.rent), frequency: "monthly", deposit: num(form.deposit), startDate: form.startDate, termMonths: num(form.termMonths) || 12 },
      depositScheme: { provider: "DPS", status: "not_started", ref: "—" },
      documents: [],
    });
  };

  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

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
              <select className={field} value={form.property} onChange={set("property")}>
                <option value="">Select…</option>
                {properties.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Room</label><input className={field} value={form.room} onChange={set("room")} placeholder="Room 3" /></div>
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

          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">Start Onboarding</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminOnboarding() {
  const [items, setItems] = useState(onboarding);
  const [selectedId, setSelectedId] = useState(onboarding[0]?.id);
  const [showAdd, setShowAdd] = useState(false);
  const a = items.find((x) => x.id === selectedId) || items[0];
  const progress = a ? Math.round((a.stageIndex / (ONBOARDING_STAGES.length - 1)) * 100) : 0;

  const create = (obj) => {
    onboarding.unshift(obj); // sync to shared store
    setItems([...onboarding]);
    setSelectedId(obj.id);
    setShowAdd(false);
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

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "In progress", value: items.filter((o) => o.stageIndex < 6).length, tone: "bg-blue-50 text-blue-600" },
          { label: "Referencing", value: items.filter((o) => o.stageIndex === 1).length, tone: "bg-amber-50 text-amber-600" },
          { label: "Ready to move-in", value: items.filter((o) => o.stageIndex >= 5).length, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Total applicants", value: items.length, tone: "bg-orange-50 text-[#F47C3C]" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Master list */}
        <div className="lg:col-span-1 space-y-2">
          {items.map((o) => {
            const p = Math.round((o.stageIndex / (ONBOARDING_STAGES.length - 1)) * 100);
            const active = o.id === selectedId;
            return (
              <button key={o.id} onClick={() => setSelectedId(o.id)} className={`w-full text-left bg-white border rounded-2xl p-4 transition-all ${active ? "border-[#F47C3C] ring-2 ring-[#F47C3C]/20" : "border-gray-100 hover:shadow-md"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-sm font-bold shrink-0">{initials(o.name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#0F253B] text-sm truncate">{o.name}</p>
                    <p className="text-[11px] text-gray-400 font-medium truncate">{o.tenancy.property} · {o.tenancy.room}</p>
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
        <div className="lg:col-span-2 space-y-4">
          {/* Header + stepper */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#0F253B] text-white flex items-center justify-center font-bold">{initials(a.name)}</div>
                <div>
                  <h2 className="text-lg font-bold text-[#0F253B]">{a.name}</h2>
                  <p className="text-xs text-gray-400 font-medium flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1"><Mail size={11} />{a.email}</span>
                    <span className="flex items-center gap-1"><Phone size={11} />{a.phone}</span>
                  </p>
                </div>
              </div>
              <Badge tone={progress === 100 ? "green" : "orange"}>{progress}% complete</Badge>
            </div>
            <Stepper index={a.stageIndex} />
          </div>

          {/* Tenancy terms */}
          <Section icon={Home} title="Tenancy Terms">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Property" value={a.tenancy.property} />
              <Field label="Room" value={a.tenancy.room} />
              <Field label="Rent" value={`${money(a.tenancy.rent)}/mo`} />
              <Field label="Deposit" value={money(a.tenancy.deposit)} />
              <Field label="Start date" value={a.tenancy.startDate} />
              <Field label="Term" value={`${a.tenancy.termMonths} months`} />
              <Field label="Frequency" value={a.tenancy.frequency} />
              <Field label="Holding deposit" value={money(a.holdingDeposit)} />
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
              <Field label="Employer" value={a.employment.employer} />
              <Field label="Job title" value={a.employment.jobTitle} />
              <Field label="Type" value={a.employment.type} />
              <Field label="Annual income" value={money(a.employment.annualIncome)} />
              <Field label="Started" value={a.employment.startDate} />
              <Field label="Rent : income" value={`${a.employment.annualIncome ? Math.round((a.tenancy.rent * 12 / a.employment.annualIncome) * 100) : 0}%`} />
            </div>
          </Section>

          {/* Right to Rent */}
          <Section icon={ShieldCheck} title="Right to Rent" action={<Badge tone={tone(a.rightToRent.status)}>{a.rightToRent.status}</Badge>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Document" value={a.rightToRent.docType} />
              <Field label="Number" value={a.rightToRent.docNumber} />
              <Field label="Expiry" value={a.rightToRent.expiry} />
              <Field label="Share code" value={a.rightToRent.shareCode} />
            </div>
          </Section>

          {/* References */}
          <Section icon={FileText} title="References">
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Previous landlord", v: a.references.previousLandlord },
                { label: "Employer", v: a.references.employer },
                { label: "Credit check", v: a.references.credit },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50">
                  <span className="text-xs font-semibold text-[#0F253B]">{r.label}</span>
                  <Badge tone={tone(r.v)}>{r.v}</Badge>
                </div>
              ))}
            </div>
          </Section>

          {/* Guarantor */}
          <Section icon={Users2} title="Guarantor" action={<Badge tone={tone(a.guarantor.status)}>{a.guarantor.status.replace("_", " ")}</Badge>}>
            {a.guarantor.status === "not_required" ? (
              <p className="text-sm text-gray-400 font-medium">Not required — applicant meets affordability criteria.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Name" value={a.guarantor.name} />
                <Field label="Relationship" value={a.guarantor.relationship} />
                <Field label="Annual income" value={money(a.guarantor.annualIncome)} />
                <Field label="Address" value={a.guarantor.address} />
                <Field label="Phone" value={a.guarantor.phone} />
              </div>
            )}
          </Section>

          {/* Deposit */}
          <Section icon={Wallet} title="Deposit Protection" action={<Badge tone={tone(a.depositScheme.status)}>{a.depositScheme.status.replace("_", " ")}</Badge>}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Scheme" value={a.depositScheme.provider} />
              <Field label="Amount" value={money(a.tenancy.deposit)} />
              <Field label="Reference" value={a.depositScheme.ref} />
            </div>
          </Section>

          {/* Documents */}
          <Section icon={FileText} title="Documents">
            {a.documents.length === 0 && <p className="text-sm text-gray-400 font-medium">No documents uploaded yet.</p>}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {a.documents.map((d) => (
                <li key={d.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C] shrink-0"><FileText size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{d.name}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{d.type}</p>
                  </div>
                  <Badge tone={tone(d.status)}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {showAdd && <NewOnboardingModal onClose={() => setShowAdd(false)} onCreate={create} />}
    </div>
  );
}
