"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Home,
  CalendarDays,
  PoundSterling,
  ShieldCheck,
  CheckCircle2,
  Clock3,
  Circle,
  Loader2,
  Inbox,
  Building2,
  Mail,
  Phone,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  XCircle,
  ChevronRight,
} from "lucide-react";
import api from "../../api/api";
import { uploadFileToCloudinary } from "../../utils/uploadToCloudinary";

const money = (n) =>
  n == null || n === "" ? "—" : `£${Number(n).toLocaleString("en-GB")}`;

const DOC_TYPES = [
  "ID / Passport",
  "Proof of income",
  "Bank statement",
  "Right to Rent",
  "Guarantor ID",
  "Reference",
  "Other",
];

const initials = (name) =>
  (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

/* ------------------------------------------------------------------ */
/* Documents — tenant uploads; operator sees + verifies on admin side  */
/* ------------------------------------------------------------------ */

function DocumentsCard({ onboarding, onUpdate }) {
  const fileRef = useRef(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const docs = onboarding.documents || [];

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url, publicId, name } = await uploadFileToCloudinary(file);
      const res = await api.post(`/onboarding/me/${onboarding._id}/documents`, {
        name,
        type: docType,
        url,
        publicId,
      });
      onUpdate(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (docId, name) => {
    if (!confirm(`Remove document "${name}"?`)) return;
    setBusyId(docId);
    setError("");
    try {
      const res = await api.delete(`/onboarding/me/${onboarding._id}/documents/${docId}`);
      onUpdate(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove document");
    } finally {
      setBusyId(null);
    }
  };

  const statusPill = (s) => {
    if (s === "verified")
      return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-700"><CheckCircle2 className="h-3 w-3" /> Verified</span>;
    if (s === "failed")
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700"><XCircle className="h-3 w-3" /> Rejected</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700"><Clock3 className="h-3 w-3" /> Pending</span>;
  };

  return (
    <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-bold">My Documents</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />
        </div>
      </div>

      <p className="mb-4 text-sm text-slate-400">
        Upload a PDF or image. Your operator reviews each document and marks it verified.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border-l-4 border-red-500 bg-red-50 p-2.5 text-xs font-bold text-red-700">{error}</div>
      )}

      {docs.length === 0 ? (
        <p className="text-sm font-medium text-slate-400">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d._id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white text-indigo-600">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-sm font-bold text-slate-900 hover:text-indigo-600">
                  {d.name} <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
                <p className="text-[11px] font-medium text-slate-400">{d.type || "Document"}</p>
              </div>
              {statusPill(d.status)}
              {d.status === "pending" && (
                busyId === d._id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <button onClick={() => remove(d._id, d.name)} title="Remove" className="text-slate-300 transition hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TenantOnboardingPage() {
  const [list, setList] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/onboarding/me");
        if (!active) return;
        const items = res.data?.data || [];
        setList(items);
        setStages(res.data?.stages || []);
        setSelectedId(items[0]?._id || null);
      } catch (err) {
        if (active) setError("Could not load your onboarding. Please try again shortly.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Replace one onboarding in the list (after a document upload / delete).
  const replaceOnboarding = (updated) =>
    setList((xs) => xs.map((o) => (o._id === updated._id ? { ...o, ...updated } : o)));

  const selected = list.find((o) => o._id === selectedId) || list[0] || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">My Onboarding</h1>
          <p className="mt-2 text-slate-500">
            {list.length > 1
              ? "Review your accepted options and select one to continue."
              : "Track your move-in progress."}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-100 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Empty state — no accepted request yet */}
        {!error && list.length === 0 && (
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm border border-slate-200">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Inbox className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">No onboarding yet</h2>
            <p className="mx-auto mt-2 max-w-md text-slate-500">
              When you send a viewing request from a listing and the operator accepts it,
              your onboarding will appear here.
            </p>
            <Link
              href="/#properties"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F47C3C] px-5 py-3 font-bold text-white transition hover:brightness-105"
            >
              <Home className="h-4 w-4" /> Browse properties
            </Link>
          </div>
        )}

        {/* Options selector — only when the tenant has more than one */}
        {list.length > 1 && (
          <div className="mb-6 rounded-3xl border bg-white p-5 shadow-sm">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Your options ({list.length})
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((o) => {
                const pct = stages.length ? Math.round((o.stageIndex / (stages.length - 1)) * 100) : 0;
                const active = o._id === selected?._id;
                return (
                  <button
                    key={o._id}
                    onClick={() => setSelectedId(o._id)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${active ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-100 hover:shadow-md"}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                      {initials(o.organization?.name || o.tenancy?.property)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{o.tenancy?.property || "Property"}</p>
                      <p className="truncate text-[11px] font-medium text-slate-400">
                        {o.tenancy?.room && o.tenancy.room !== "—" ? `${o.tenancy.room} · ` : ""}
                        {o.completedAt
                          ? "Complete"
                          : `${stages[o.stageIndex] || "Application"} · ${pct}%`}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${active ? "text-indigo-500" : "text-slate-300"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selected && (
          <>
            {/* Completed banner — tenancy is active, room is accessible */}
            {selected.completedAt && (
              <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-green-200 bg-green-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
                  <div>
                    <p className="font-bold text-green-800">Onboarding complete 🎉</p>
                    <p className="text-sm text-green-700">
                      Your tenancy is active — you can now view your room and details.
                    </p>
                  </div>
                </div>
                <Link
                  href="/tenant/room"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700"
                >
                  <Home className="h-4 w-4" /> Go to My Room
                </Link>
              </div>
            )}

            {/* Property / summary card */}
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <div className="flex flex-col gap-6 md:flex-row md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-bold">{selected.tenancy?.property || "Your property"}</h2>
                  </div>
                  <p className="mt-1 text-slate-500">{selected.tenancy?.room || "—"}</p>
                  {selected.organization?.name && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400">
                      <Building2 className="h-4 w-4" /> Managed by {selected.organization.name}
                    </p>
                  )}
                </div>

                <span className="inline-flex h-fit rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
                  Onboarding Active
                </span>
              </div>

              {/* Info */}
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border p-5">
                  <CalendarDays className="mb-3 h-7 w-7 text-indigo-600" />
                  <p className="text-sm text-slate-500">Move-in Date</p>
                  <h3 className="mt-1 font-semibold">{selected.tenancy?.startDate || "To be confirmed"}</h3>
                </div>

                <div className="rounded-2xl border p-5">
                  <PoundSterling className="mb-3 h-7 w-7 text-green-600" />
                  <p className="text-sm text-slate-500">Rent</p>
                  <h3 className="mt-1 font-semibold">
                    {selected.tenancy?.rent ? `${money(selected.tenancy.rent)}/month` : "To be confirmed"}
                  </h3>
                </div>

                <div className="rounded-2xl border p-5">
                  <ShieldCheck className="mb-3 h-7 w-7 text-amber-500" />
                  <p className="text-sm text-slate-500">Deposit</p>
                  <h3 className="mt-1 font-semibold">
                    {selected.tenancy?.deposit ? money(selected.tenancy.deposit) : "To be confirmed"}
                  </h3>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
              <h2 className="mb-8 text-xl font-bold">Onboarding Progress</h2>
              <div className="space-y-8">
                {stages.map((title, index) => {
                  // Once onboarding is completed every stage is done, including
                  // the last one. Without this the final stage stays "In
                  // Progress" forever, because completing sets stageIndex to
                  // the last index and `index === stageIndex` reads as current.
                  const status = selected.completedAt
                    ? "completed"
                    : index < selected.stageIndex
                    ? "completed"
                    : index === selected.stageIndex
                    ? "progress"
                    : "pending";
                  return (
                    <div key={title} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        {status === "completed" ? (
                          <CheckCircle2 className="h-8 w-8 text-green-600" />
                        ) : status === "progress" ? (
                          <Clock3 className="h-8 w-8 text-amber-500" />
                        ) : (
                          <Circle className="h-8 w-8 text-slate-300" />
                        )}
                        {index !== stages.length - 1 && (
                          <div className="mt-2 h-full w-px bg-slate-200" />
                        )}
                      </div>

                      <div className="flex-1 pb-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-semibold text-lg">{title}</h3>
                          {status === "completed" && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">Completed</span>
                          )}
                          {status === "progress" && (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">In Progress</span>
                          )}
                          {status === "pending" && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">Not Started</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Documents — tenant uploads, operator verifies */}
            <DocumentsCard onboarding={selected} onUpdate={replaceOnboarding} />

            {/* Contact operator */}
            {selected.organization && (selected.organization.phone || selected.organization.name) && (
              <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-bold">Your Operator</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <Building2 className="h-4 w-4 text-indigo-600" /> {selected.organization.name}
                  </span>
                  {selected.organization.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-indigo-600" /> {selected.organization.phone}
                    </span>
                  )}
                  {selected.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-indigo-600" /> {selected.email}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
