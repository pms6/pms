"use client";

import { useState } from "react";
import { Download, Eye, X, TrendingUp, FileText, Home, Clock } from "lucide-react";
import { PageHeader, Card, Badge } from "../../Shared/ui";
import { rentReviews, properties, money } from "../_data/dummy";

const pct = (cur, target) => (target ? Math.round((cur / target) * 100) : 0);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

export default function AdminRentReview() {
  const [propF, setPropF] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [view, setView] = useState(null);

  const list = rentReviews.filter(
    (r) => (!propF || r.property === propF) && (!dueOnly || r.dueTenancy || r.dueUnit)
  );

  const tenanciesToReview = rentReviews.filter((r) => r.dueTenancy).length;
  const unitsToReview = rentReviews.filter((r) => r.dueUnit).length;
  const propertyNames = properties.map((p) => p.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent Review"
        subtitle="Upcoming tenancy and unit rent reviews across all properties"
        action={
          <button onClick={() => alert("Rent review data — CSV export (demo)")} className="flex items-center gap-2 px-4 py-2.5 bg-[#0F253B] hover:bg-[#1c3e5e] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Download size={18} /> Export CSV
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#0F253B] to-[#1c3e5e] text-white p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center"><TrendingUp size={22} /></div>
          <div>
            <p className="text-3xl font-bold">{tenanciesToReview}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Tenancies to Review</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center"><Home size={22} /></div>
          <div>
            <p className="text-3xl font-bold text-[#0F253B]">{unitsToReview}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Units to Review</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={propF} onChange={(e) => setPropF(e.target.value)} className="px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
          <option value="">All properties</option>
          {propertyNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setDueOnly((v) => !v)} className={`px-3.5 py-2.5 text-sm font-bold rounded-xl border transition-all ${dueOnly ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
          Due Only
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Property &amp; Room</th>
                <th className="px-5 py-3">Fixed Term End</th>
                <th className="px-5 py-3">Next Review</th>
                <th className="px-5 py-3 text-right">Current Rent</th>
                <th className="px-5 py-3 text-right">Unit Target</th>
                <th className="px-5 py-3 text-right">Target %</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No rent reviews match these filters</td></tr>
              ) : (
                list.map((r) => {
                  const p = pct(r.currentRent, r.unitTargetRent);
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <p className="font-bold text-[#0F253B]">{r.tenant}</p>
                        {(r.dueTenancy || r.dueUnit) && <Badge tone="amber">Due</Badge>}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{r.property}{r.room !== "—" ? ` · ${r.room}` : ""}</td>
                      <td className="px-5 py-3 text-gray-500">{fmtDate(r.fixedTermEnd)}</td>
                      <td className="px-5 py-3 text-gray-500">{fmtDate(r.nextReviewDate)}</td>
                      <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(r.currentRent)}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{money(r.unitTargetRent)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${p >= 100 ? "text-emerald-600" : p >= 95 ? "text-amber-600" : "text-red-500"}`}>{p}%</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setView(r)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"><Eye size={14} /> View</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-[#0F253B]">{view.tenant}</h3>
                <p className="text-xs text-gray-400 font-medium">{view.property}{view.room !== "—" ? ` · ${view.room}` : ""}</p>
              </div>
              <button onClick={() => setView(null)} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
            </div>

            {/* Tenancy + Unit review details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3">Tenancy</p>
                <dl className="space-y-2 text-sm">
                  {[
                    ["Last Tenancy Rent Review", fmtDate(view.lastTenancyReview)],
                    ["Current Tenancy Rent", money(view.currentRent)],
                    ["Last Reviewed Target Rent", view.lastReviewedTargetRent ? money(view.lastReviewedTargetRent) : "—"],
                    ["Next Tenancy Rent Review", fmtDate(view.nextTenancyReviewDate)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><dt className="text-gray-400 font-medium">{k}</dt><dd className="font-bold text-[#0F253B] text-right">{v}</dd></div>
                  ))}
                </dl>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3">Unit</p>
                <dl className="space-y-2 text-sm">
                  {[
                    ["Last Unit Review", fmtDate(view.lastUnitReview)],
                    ["Unit Target Rent", money(view.unitTargetRent)],
                    ["Minimum Viable Rent", money(view.minViableRent)],
                    ["Next Unit Review", fmtDate(view.nextUnitReviewDate)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><dt className="text-gray-400 font-medium">{k}</dt><dd className="font-bold text-[#0F253B] text-right">{v}</dd></div>
                  ))}
                </dl>
              </div>
            </div>

            {/* History */}
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-[#F47C3C]" />
              <h4 className="font-bold text-[#0F253B]">Rent Review History</h4>
            </div>
            {view.history.length === 0 ? (
              <p className="text-sm text-gray-400 font-medium bg-gray-50 rounded-xl p-4 text-center">No rent reviews available.</p>
            ) : (
              <div className="border border-gray-100 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-2.5">Review Date</th>
                      <th className="px-4 py-2.5 text-right">Opening</th>
                      <th className="px-4 py-2.5 text-right">New</th>
                      <th className="px-4 py-2.5 text-right">Change</th>
                      <th className="px-4 py-2.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.history.map((h, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-gray-500">{fmtDate(h.date)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{money(h.opening)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[#0F253B]">{money(h.newAmount)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-bold">+{money(h.change)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-bold">+{h.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button onClick={() => alert("Review Tenancy Rent (demo)")} className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">
                <TrendingUp size={18} /> Review Tenancy Rent
              </button>
              <button onClick={() => alert("Generate Section 13 Form (demo)")} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-[#0F253B] font-bold rounded-xl transition-all">
                <FileText size={18} /> Generate Section 13 Form
              </button>
            </div>
            <button onClick={() => setView(null)} className="w-full mt-3 py-2.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
