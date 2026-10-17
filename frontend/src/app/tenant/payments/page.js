"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import api from "@/app/api/api";
import { AttachmentRow, MediaUploader } from "@/app/Shared/MediaAttachments";

const fmtMoney = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const fmtAmount = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const LABELS = { awaiting_confirmation: "Awaiting confirmation" };
const label = (s) => LABELS[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// "Rent (1 Jul)" style description from a due date.
const chargeTitle = (d) =>
  `Rent (${new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`;

const StatusIcon = ({ status }) => {
  if (status === "paid") return <CheckCircle className="text-emerald-500 w-4 h-4" />;
  if (status === "awaiting_confirmation") return <Clock className="text-sky-500 w-4 h-4" />;
  if (status === "due" || status === "overdue")
    return <AlertCircle className="text-rose-500 w-4 h-4" />;
  return <Clock className="text-amber-500 w-4 h-4" />;
};

export default function RentPage() {
  const [charges, setCharges] = useState([]);
  const [summary, setSummary] = useState({ monthlyRent: 0, nextDueDate: null, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [claimChargeId, setClaimChargeId] = useState(null);
  const [editingProof, setEditingProof] = useState(false);
  const [paymentProof, setPaymentProof] = useState([]);
  const [proofUploading, setProofUploading] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");

  const load = useCallback(async () => {
    const res = await api.get("/payments/my");
    setCharges(res.data?.data?.charges || []);
    setSummary(res.data?.data?.summary || { monthlyRent: 0, nextDueDate: null, balance: 0 });
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (active) setError(err?.response?.data?.message || "Failed to load your payments.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // Admin confirmation is reflected automatically while the tenant page stays
  // open, and immediately when they return to the tab.
  useEffect(() => {
    const refresh = () => load().catch(() => {});
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  const openProofForm = (id) => {
    const charge = charges.find((item) => item._id === id);
    const isEditing = charge?.status === "awaiting_confirmation";
    setClaimChargeId(id);
    setEditingProof(isEditing);
    setPaymentProof(isEditing ? (charge.claimedProof || []) : []);
    setProofUploading(0);
    setPaymentMethod(isEditing ? (charge.claimedMethod || "Bank Transfer") : "Bank Transfer");
  };

  const pay = async () => {
    if (!claimChargeId || paymentProof.length === 0 || proofUploading > 0) return;
    const id = claimChargeId;
    setPayingId(id);
    try {
      const body = { method: paymentMethod, proof: paymentProof };
      if (editingProof) await api.put(`/payments/${id}/proof`, body);
      else await api.post(`/payments/${id}/pay`, body);
      setClaimChargeId(null);
      setEditingProof(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to record payment.");
    } finally {
      setPayingId(null);
    }
  };

  const stats = [
    { label: "Monthly Rent", value: fmtMoney(summary.monthlyRent), icon: FileText },
    { label: "Next Due Date", value: summary.nextDueDate ? fmtDate(summary.nextDueDate) : "—", icon: Clock },
    { label: "Account Balance", value: fmtAmount(summary.balance), icon: Wallet },
  ];

  // Tenants may submit proof early for the next upcoming monthly charge too.
  const canPay = (s) => s === "due" || s === "overdue" || s === "upcoming";

  return (
    <div className="max-w-5xl mx-auto px-0.5 sm:px-6 lg:px-8 py-6 space-y-6 bg-slate-50 min-h-screen">

      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
          Payment Dashboard
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your rent, view payment history, and record payments.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white p-4 sm:p-6 rounded-xl border border-amber-400 shadow-sm flex items-center gap-3"
          >
            <div className="p-2 sm:p-3 bg-orange-50 rounded-lg text-[#F47C3C]">
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider">
                {stat.label}
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-800">
                {loading ? "…" : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          Loading your payments…
        </div>
      ) : charges.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
            <Wallet className="text-[#F47C3C]" size={24} />
          </div>
          <p className="text-slate-600 font-medium">No rent charges yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Once your tenancy is active, your rent schedule will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE (hidden on mobile) */}
          <div className="hidden md:block bg-white rounded-2xl border border-amber-400 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50">
                <tr>
                  {["Date", "Description", "Status", "Amount", "Balance", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-slate-500 uppercase p-4"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y">
                {charges.map((item) => (
                  <tr key={item._id} className="hover:bg-orange-50/50">
                    <td className="p-4">{fmtDate(item.dueDate)}</td>
                    <td className="p-4">
                      {chargeTitle(item.dueDate)}
                      {item.claimedProof?.length > 0 && <div className="mt-2 space-y-1">{item.claimedProof.map((file, index) => <AttachmentRow key={file.url || index} file={file} />)}</div>}
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-2">
                        <StatusIcon status={item.status} />
                        {item.status === "paid" && item.paidLate ? "Paid late" : label(item.status)}
                      </span>
                    </td>
                    <td className="p-4 font-semibold">{fmtAmount(item.amount)}</td>
                    <td className="p-4 text-slate-500">
                      {item.status === "paid" ? fmtAmount(0) : fmtAmount(item.amount)}
                    </td>
                    <td className="p-4">
                      {canPay(item.status) ? (
                        <button
                          onClick={() => openProofForm(item._id)}
                          disabled={payingId === item._id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#F47C3C] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#e06d30] disabled:opacity-50"
                        >
                          {payingId === item._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Submit payment proof
                        </button>
                      ) : item.status === "awaiting_confirmation" ? (
                        <button onClick={() => openProofForm(item._id)} className="text-xs font-bold text-[#F47C3C] hover:underline">Edit submitted proof</button>
                      ) : item.status === "paid" ? (
                        <span className="text-xs font-medium text-slate-400">
                          {item.method ? `Paid · ${item.method}` : "Paid"}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-3">
            {charges.map((item) => (
              <div
                key={item._id}
                className="bg-white p-4 rounded-xl border border-amber-400 shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-slate-800">{chargeTitle(item.dueDate)}</p>
                  <span className="flex items-center gap-1 text-sm">
                    <StatusIcon status={item.status} />
                    {item.status === "paid" && item.paidLate ? "Paid late" : label(item.status)}
                  </span>
                </div>

                <div className="mt-2 text-sm text-slate-500">
                  <p>Date: {fmtDate(item.dueDate)}</p>
                  <p>Amount: {fmtAmount(item.amount)}</p>
                  <p>Balance: {item.status === "paid" ? fmtAmount(0) : fmtAmount(item.amount)}</p>
                </div>

                {item.claimedProof?.length > 0 && <div className="mt-3 space-y-1">{item.claimedProof.map((file, index) => <AttachmentRow key={file.url || index} file={file} />)}</div>}

                {canPay(item.status) && (
                  <button
                    onClick={() => openProofForm(item._id)}
                    disabled={payingId === item._id}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F47C3C] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#e06d30] disabled:opacity-50"
                  >
                    {payingId === item._id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit payment proof
                  </button>
                )}
                {item.status === "awaiting_confirmation" && <button onClick={() => openProofForm(item._id)} className="mt-3 w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-[#F47C3C]">Edit submitted proof</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {claimChargeId && (() => {
        const charge = charges.find((item) => item._id === claimChargeId);
        if (!charge) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(event) => { if (event.target === event.currentTarget && !payingId) setClaimChargeId(null); }}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
              <h2 className="text-lg font-bold text-slate-900">{editingProof ? "Edit submitted payment proof" : "Submit rent payment proof"}</h2>
              <p className="mt-1 text-sm text-slate-500">{chargeTitle(charge.dueDate)} · {fmtAmount(charge.amount)}</p>
              <p className="mt-3 text-xs text-slate-500">{editingProof ? "Remove the incorrect attachment or add the correct screenshot/receipt. The admin can review the updated proof." : "Attach a screenshot or receipt. Your account will show “Awaiting confirmation” until the property team checks it."}</p>
              <div className="mt-4">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment method</label>
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  {["Bank Transfer", "Cash", "Card", "Other"].map((method) => <option key={method}>{method}</option>)}
                </select>
              </div>
              <div className="mt-4">
                <MediaUploader files={paymentProof} onChange={(update) => setPaymentProof((current) => typeof update === "function" ? update(current) : update || [])} onUploadingChange={setProofUploading} label="Payment screenshot or receipt" hint="Add a screenshot, receipt or PDF payment confirmation" accept="image/*,application/pdf" />
              </div>
              <div className="mt-5 flex gap-2">
                <button type="button" disabled={payingId === claimChargeId || proofUploading > 0 || paymentProof.length === 0} onClick={pay} className="flex-1 rounded-xl bg-[#F47C3C] px-4 py-3 text-sm font-bold text-white hover:bg-[#e06d30] disabled:opacity-50">
                  {payingId === claimChargeId ? "Saving…" : editingProof ? "Save updated proof" : "Submit proof"}
                </button>
                <button type="button" disabled={Boolean(payingId)} onClick={() => setClaimChargeId(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 disabled:opacity-40">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
