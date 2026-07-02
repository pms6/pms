"use client";

import { useState } from "react";
import {
  Check, User, Briefcase, ShieldCheck, FileText, Users2, Wallet, Home,
  Mail, Phone, ChevronRight,
} from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { onboarding, ONBOARDING_STAGES, money } from "../_data/dummy";

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

export default function AdminOnboarding() {
  const [selectedId, setSelectedId] = useState(onboarding[0].id);
  const a = onboarding.find((x) => x.id === selectedId);
  const progress = Math.round((a.stageIndex / (ONBOARDING_STAGES.length - 1)) * 100);

  return (
    <div className="space-y-5">
      <PageHeader title="Onboarding" subtitle="Move applicants from offer to move-in" />

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "In progress", value: onboarding.filter((o) => o.stageIndex < 6).length, tone: "bg-blue-50 text-blue-600" },
          { label: "Referencing", value: onboarding.filter((o) => o.stageIndex === 1).length, tone: "bg-amber-50 text-amber-600" },
          { label: "Ready to move-in", value: onboarding.filter((o) => o.stageIndex >= 5).length, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Total applicants", value: onboarding.length, tone: "bg-orange-50 text-[#F47C3C]" },
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
          {onboarding.map((o) => {
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
              <Field label="Rent : income" value={`${Math.round((a.tenancy.rent * 12 / a.employment.annualIncome) * 100) || 0}%`} />
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
    </div>
  );
}
