"use client";

import { useState } from "react";
import { Star, Download, Eye, X, MessageSquare, Smile } from "lucide-react";
import { PageHeader, Card, Badge } from "../../Shared/ui";
import { satisfaction, feedbackRecords, reviews, FEEDBACK_TYPES, properties } from "../_data/dummy";

const TYPE_TONE = { Overall: "orange", Service: "blue", Housemates: "green", Tidiness: "amber" };

function Stars({ value, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? "text-[#F47C3C] fill-[#F47C3C]" : "text-gray-200 fill-gray-200"} />
      ))}
    </span>
  );
}

export default function AdminFeedback() {
  const [month, setMonth] = useState(satisfaction[satisfaction.length - 1].month);
  const [typeF, setTypeF] = useState("");
  const [scoreF, setScoreF] = useState("");
  const [propF, setPropF] = useState("");
  const [review, setReview] = useState(null);

  const avg = (satisfaction.reduce((s, m) => s + m.score, 0) / satisfaction.length).toFixed(1);
  const maxScore = 5;
  const propertyNames = properties.map((p) => p.name);

  const records = feedbackRecords.filter(
    (r) => r.month === month && (!typeF || r.type === typeF) && (!scoreF || r.score === Number(scoreF)) && (!propF || r.property === propF)
  );

  const exportBtn = (label) => (
    <button
      key={label}
      onClick={() => alert(`${label} — CSV export (demo)`)}
      className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-xs rounded-xl transition-all"
    >
      <Download size={15} /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Feedback" subtitle="Tenant experience, satisfaction & reviews across all properties" />

      {/* ---- Tenant Satisfaction ---- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Smile size={18} className="text-[#F47C3C]" />
          <h2 className="text-lg font-bold text-[#0F253B]">Tenant Satisfaction</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#0F253B] to-[#1c3e5e] text-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Avg Overall Score</p>
            <p className="text-4xl font-bold mt-2">{avg}<span className="text-lg text-white/50">/5</span></p>
            <div className="mt-2"><Stars value={Number(avg)} /></div>
            <p className="text-xs text-white/60 mt-2">From Overall feedback across all months</p>
          </div>

          <Card title="Monthly Overall Satisfaction" className="lg:col-span-3">
            <div className="flex items-end gap-4 h-40 pt-2">
              {satisfaction.map((m) => {
                const active = m.month === month;
                return (
                  <button key={m.month} onClick={() => setMonth(m.month)} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className={`text-xs font-bold ${active ? "text-[#F47C3C]" : "text-gray-400"}`}>{m.score}</span>
                    <div className="w-full bg-gray-100 rounded-lg flex items-end h-full">
                      <div className={`w-full rounded-lg transition-all ${active ? "bg-[#F47C3C]" : "bg-[#0F253B]/70 group-hover:bg-[#0F253B]"}`} style={{ height: `${(m.score / maxScore) * 100}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold ${active ? "text-[#0F253B]" : "text-gray-400"}`}>{m.month}</span>
                    <span className="text-[10px] text-gray-300 font-medium">{m.responses} resp.</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 font-medium mt-2">Tap a month to view its feedback below.</p>
          </Card>
        </div>
      </div>

      {/* ---- Feedbacks for the Selected Month ---- */}
      <div>
        <h2 className="text-lg font-bold text-[#0F253B] mb-3">Feedbacks for {month}</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
            <option value="">All types</option>
            {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={scoreF} onChange={(e) => setScoreF(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
            <option value="">Any score</option>
            {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} ★ &amp; up</option>)}
          </select>
          <select value={propF} onChange={(e) => setPropF(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
            <option value="">All properties</option>
            {propertyNames.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3">Property</th>
                  <th className="px-5 py-3">Tenant &amp; Room</th>
                  <th className="px-5 py-3">Feedback Type</th>
                  <th className="px-5 py-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No feedback for these filters</td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-bold text-[#0F253B]">{r.property}</td>
                      <td className="px-5 py-3 text-gray-500">{r.tenant}{r.room !== "—" ? ` · ${r.room}` : ""}</td>
                      <td className="px-5 py-3"><Badge tone={TYPE_TONE[r.type] || "gray"}>{r.type}</Badge></td>
                      <td className="px-5 py-3"><span className="flex items-center gap-2"><Stars value={r.score} /><span className="text-xs font-bold text-[#0F253B]">{r.score}.0</span></span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---- Tenant Feedback (reviews) ---- */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={18} className="text-[#F47C3C]" />
          <h2 className="text-lg font-bold text-[#0F253B]">Tenant Feedback</h2>
        </div>
        <p className="text-xs text-gray-400 font-medium mb-3">Detailed reviews — separate from the satisfaction score.</p>
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Tenant</th>
                  <th className="px-5 py-3">Property &amp; Room</th>
                  <th className="px-5 py-3">Overall</th>
                  <th className="px-5 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-500">{new Date(r.date).toLocaleDateString("en-GB")}</td>
                    <td className="px-5 py-3 font-bold text-[#0F253B]">{r.tenant}</td>
                    <td className="px-5 py-3 text-gray-500">{r.property}{r.room !== "—" ? ` · ${r.room}` : ""}</td>
                    <td className="px-5 py-3"><Stars value={r.rating} /></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setReview(r)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"><Eye size={14} /> View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---- Export ---- */}
      <Card title="Export">
        <div className="flex flex-wrap gap-3">
          {["Monthly Summaries (CSV)", "Raw Feedback (CSV)", "Reviews (CSV)"].map(exportBtn)}
        </div>
      </Card>

      {/* Review modal */}
      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReview(null)}>
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#0F253B]">{review.tenant}</h3>
                <p className="text-xs text-gray-400 font-medium">{review.property}{review.room !== "—" ? ` · ${review.room}` : ""} · {new Date(review.date).toLocaleDateString("en-GB")}</p>
              </div>
              <button onClick={() => setReview(null)} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Stars value={review.rating} size={18} />
              <span className="text-sm font-bold text-[#0F253B]">{review.rating}.0 / 5</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-2xl p-4">{review.text}</p>
            <button onClick={() => setReview(null)} className="w-full mt-5 py-3 bg-[#0F253B] hover:bg-[#1c3e5e] text-white font-bold rounded-xl transition-all">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
