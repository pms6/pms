"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Pencil, Search, Gavel, CheckCircle2, Circle } from "lucide-react";
import { PageHeader, Badge } from "./ui";
import { MediaUploader, MediaViewerModal } from "./MediaAttachments";
import api from "@/app/api/api";
import { fmtDate, monthKey, monthLabel } from "@/app/utils/cleaningSheet";
import {
  FIELD,
  LABEL,
  money,
  toInputDate,
  filesOf,
  FileStrip,
  ModalShell,
  PropertyFields,
  ErrorBanner,
  SubmitButton,
  ViewRow,
  FilesBlock,
  RowActions,
  EmptyRow,
} from "./registerParts";

/* ------------------------------------------------------------------ *
 * The Court Claims sheet:
 *
 *   sr | Claim Date | Property | Claim By | Claim to | Amount | Rent |
 *   Deposit | Deadline to Respond | Claim Reason | Attachments
 *
 * plus a Details field for the full write-up behind the short reason.
 * "sr" is the row number, so it is never stored. MUST stay in sync with
 * backend/models/CourtClaim.js.
 * ------------------------------------------------------------------ */

// MUST stay in sync with CLAIM_STATUSES in backend/models/CourtClaim.js.
export const CLAIM_STATUSES = ["In Progress", "Paid"];
const STATUS_TONE = { "In Progress": "amber", Paid: "green" };

// Rows written before the status existed come back without one.
const statusOf = (row) => (CLAIM_STATUSES.includes(row?.status) ? row.status : "In Progress");

// Blank for a claim not settled yet, rather than a misleading £0.00.
const hasSettlement = (row) => row?.settlementAmount !== null && row?.settlementAmount !== undefined;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// A response deadline that has already passed.
const isOverdue = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && d < startOfToday();
};

// A response deadline still to come (today counts).
const isUpcoming = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && d >= startOfToday();
};

const matchesSearch = (row, needle) =>
  [row.property, row.claimBy, row.claimTo, row.claimReason, row.details].some((v) =>
    String(v || "").toLowerCase().includes(needle)
  );

/* ------------------------------------------------------------------ *
 * Add / edit one claim
 * ------------------------------------------------------------------ */
function ClaimModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    claimDate: toInputDate(initial?.claimDate) || toInputDate(new Date()),
    claimBy: initial?.claimBy || "",
    claimTo: initial?.claimTo || "",
    amount: initial?.amount ?? "",
    rent: initial?.rent ?? "",
    deposit: initial?.deposit ?? "",
    settlementAmount: initial?.settlementAmount ?? "",
    status: statusOf(initial),
    paidAt: toInputDate(initial?.paidAt),
    deadlineToRespond: toInputDate(initial?.deadlineToRespond),
    claimReason: initial?.claimReason || "",
    details: initial?.details || "",
  });

  // Kept out of `form` because the uploader appends to it asynchronously while
  // the rest of the form is being typed.
  const [files, setFiles] = useState(() => filesOf(initial?.files));
  const [uploadingCount, setUploadingCount] = useState(0);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v) => (v === "" ? 0 : Number(v));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    if (!form.claimDate) { setError("Claim date is required"); return; }
    // Saving mid-upload would drop whatever has not landed yet.
    if (uploadingCount) { setError("Wait for the uploads to finish"); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        claimDate: form.claimDate,
        claimBy: form.claimBy.trim(),
        claimTo: form.claimTo.trim(),
        amount: num(form.amount),
        rent: num(form.rent),
        deposit: num(form.deposit),
        settlementAmount: form.settlementAmount === "" ? null : Number(form.settlementAmount),
        status: form.status,
        paidAt: form.status === "Paid" ? form.paidAt || null : null,
        deadlineToRespond: form.deadlineToRespond || null,
        claimReason: form.claimReason.trim(),
        details: form.details.trim(),
        files,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save claim");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Court Claim" : "New Court Claim"}
      subtitle="Who is claiming from whom, how much, and when a response is due"
      onClose={onClose}
    >
      <ErrorBanner>{error}</ErrorBanner>

      <form onSubmit={submit} className="space-y-4">
        <PropertyFields form={form} setForm={setForm} properties={properties} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Claim date</label>
            <input type="date" className={FIELD} value={form.claimDate} onChange={set("claimDate")} required />
          </div>
          <div>
            <label className={LABEL}>Deadline to respond</label>
            <input type="date" className={FIELD} value={form.deadlineToRespond} onChange={set("deadlineToRespond")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Claim by</label>
            <input className={FIELD} value={form.claimBy} onChange={set("claimBy")} placeholder="Who is making the claim" />
          </div>
          <div>
            <label className={LABEL}>Claim to</label>
            <input className={FIELD} value={form.claimTo} onChange={set("claimTo")} placeholder="Who it is made against" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ["amount", "Amount (£)"],
            ["rent", "Rent (£)"],
            ["deposit", "Deposit (£)"],
          ].map(([key, label]) => (
            <div key={key}>
              <label className={LABEL}>{label}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={FIELD}
                value={form[key]}
                onChange={set(key)}
                placeholder="0.00"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Settlement amount (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={FIELD}
              value={form.settlementAmount}
              onChange={set("settlementAmount")}
              placeholder="Not settled yet"
            />
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className={FIELD} value={form.status} onChange={set("status")}>
              {CLAIM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {form.status === "Paid" && (
            <div>
              <label className={LABEL}>Paid on</label>
              <input type="date" className={FIELD} value={form.paidAt} onChange={set("paidAt")} title="Leave blank for today" />
            </div>
          )}
        </div>

        <div>
          <label className={LABEL}>Claim reason</label>
          <input className={FIELD} value={form.claimReason} onChange={set("claimReason")} placeholder="e.g. Unpaid rent, damage to property" />
        </div>

        <div>
          <label className={LABEL}>Details</label>
          <textarea
            rows={5}
            className={FIELD}
            value={form.details}
            onChange={set("details")}
            placeholder="The full account — what happened, dates, what has been said, next steps…"
          />
        </div>

        <MediaUploader
          files={files}
          onChange={setFiles}
          onUploadingChange={setUploadingCount}
          label="Attachments"
          hint="Drop files here, or click to choose — photos, video, PDFs, any file type"
        />

        <SubmitButton saving={saving} isEdit={isEdit} />
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Read-only detail — everything on one claim, attachments included
 * ------------------------------------------------------------------ */
function ViewModal({ row, onClose, onEdit, onOpenFiles }) {
  // A paid claim is finished — its response deadline no longer matters.
  const overdue = statusOf(row) !== "Paid" && isOverdue(row.deadlineToRespond);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] break-words">{row.property}</h3>
            <p className="text-xs text-gray-400 font-medium">Court claim · {fmtDate(row.claimDate)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={STATUS_TONE[statusOf(row)]}>{statusOf(row)}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <ViewRow label="Claim date">{fmtDate(row.claimDate)}</ViewRow>
            <ViewRow label="Deadline to respond">
              {row.deadlineToRespond ? (
                <span className={overdue ? "text-red-600" : ""}>
                  {fmtDate(row.deadlineToRespond)}
                  {overdue && " · overdue"}
                </span>
              ) : null}
            </ViewRow>
            <ViewRow label="Claim by">{row.claimBy}</ViewRow>
            <ViewRow label="Claim to">{row.claimTo}</ViewRow>
          </div>

          <div className="grid grid-cols-3 gap-4 rounded-2xl bg-gray-50 p-4">
            <ViewRow label="Amount">{money(row.amount)}</ViewRow>
            <ViewRow label="Rent">{money(row.rent)}</ViewRow>
            <ViewRow label="Deposit">{money(row.deposit)}</ViewRow>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <ViewRow label="Settlement amount">{hasSettlement(row) ? money(row.settlementAmount) : ""}</ViewRow>
            <ViewRow label="Status">{statusOf(row)}</ViewRow>
            <ViewRow label="Paid on">{row.paidAt ? fmtDate(row.paidAt) : ""}</ViewRow>
          </div>

          <ViewRow label="Claim reason">{row.claimReason}</ViewRow>

          <div>
            <p className={LABEL}>Details</p>
            {row.details ? (
              <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{row.details}</p>
            ) : (
              <p className="text-sm font-medium text-gray-300">—</p>
            )}
          </div>

          <FilesBlock
            label="Attachments"
            files={filesOf(row.files)}
            onOpen={() => onOpenFiles(row)}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onEdit(row)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            <Pencil size={16} /> Edit Claim
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[#0F253B] font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */
export default function CourtClaimsBoard({
  subtitle = "Claims, the amounts involved, response deadlines and the paperwork behind them",
}) {
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");

  // {} = create, row = edit, null = closed.
  const [modal, setModal] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewingFiles, setViewingFiles] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, propsRes] = await Promise.all([
        api.get("/court-claims"),
        api.get("/properties", { params: { limit: 200 } }),
      ]);
      setRows(listRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load court claims");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const months = useMemo(() => {
    const seen = new Set(rows.map((r) => monthKey(r.claimDate)).filter(Boolean));
    return [...seen].sort().reverse();
  }, [rows]);

  const needle = q.trim().toLowerCase();

  const visible = useMemo(
    () =>
      rows
        .filter((r) => (month ? monthKey(r.claimDate) === month : true))
        .filter((r) => (status ? statusOf(r) === status : true))
        .filter((r) => (needle ? matchesSearch(r, needle) : true)),
    [rows, month, status, needle]
  );

  // Paid / In Progress is flipped straight from the row, like the Done tick on
  // the cleaning board — no need to open the whole claim to change it.
  const toggleStatus = async (row) => {
    const next = statusOf(row) === "Paid" ? "In Progress" : "Paid";
    const snapshot = rows;
    setRows((prev) =>
      prev.map((r) => (r._id === row._id ? { ...r, status: next, paidAt: next === "Paid" ? new Date().toISOString() : null } : r))
    );
    try {
      const res = await api.put(`/court-claims/${row._id}`, { status: next, paidAt: null });
      setRows((prev) => prev.map((r) => (r._id === row._id ? res.data.data : r)));
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const save = async (payload) => {
    if (modal?._id) await api.put(`/court-claims/${modal._id}`, payload);
    else await api.post("/court-claims", payload);
    setModal(null);
    await load();
  };

  const remove = async (row) => {
    if (!confirm(`Delete the ${fmtDate(row.claimDate)} claim for "${row.property}"?`)) return;
    const snapshot = rows;
    setViewing((v) => (v?._id === row._id ? null : v));
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/court-claims/${row._id}`);
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const totalClaimed = visible.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalSettled = visible.reduce((sum, r) => sum + Number(r.settlementAmount || 0), 0);
  const cards = [
    { label: "Claims", value: visible.length },
    { label: "Total claimed", value: money(totalClaimed) },
    { label: "Total settlement", value: money(totalSettled) },
    { label: "In progress", value: visible.filter((r) => statusOf(r) === "In Progress").length },
    { label: "Paid", value: visible.filter((r) => statusOf(r) === "Paid").length },
    { label: "Awaiting response", value: visible.filter((r) => statusOf(r) !== "Paid" && isUpcoming(r.deadlineToRespond)).length },
  ];

  const thClass = "px-4 py-3 whitespace-nowrap";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Court Claims"
        subtitle={subtitle}
        action={
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> New Claim
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={load} className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search property, party, reason…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All statuses</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
            <Gavel size={15} className="text-[#F47C3C]" /> Court Claims
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className={`${thClass} w-10`}>Sr</th>
                <th className={thClass}>Property</th>
                <th className={thClass}>Claim date</th>
                <th className={thClass}>Claim by</th>
                <th className={thClass}>Claim to</th>
                <th className={thClass}>Amount</th>
                <th className={thClass}>Rent</th>
                <th className={thClass}>Deposit</th>
                <th className={thClass}>Settlement</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Deadline to respond</th>
                <th className={thClass}>Claim reason</th>
                <th className={thClass}>Attachments</th>
                <th className={`${thClass} w-32 text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <EmptyRow
                  colSpan={14}
                  loading={loading}
                  anyRows={rows.length > 0}
                  emptyText="No court claims recorded yet"
                />
              ) : (
                visible.map((r, i) => {
                  const overdue = statusOf(r) !== "Paid" && isOverdue(r.deadlineToRespond);
                  return (
                    <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-[#0F253B]">{r.property}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDate(r.claimDate)}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">{r.claimBy || "—"}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">{r.claimTo || "—"}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-bold whitespace-nowrap">{money(r.amount)}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{money(r.rent)}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{money(r.deposit)}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-bold whitespace-nowrap">
                        {hasSettlement(r) ? money(r.settlementAmount) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(r)}
                          title={statusOf(r) === "Paid" ? "Mark as in progress" : "Mark as paid"}
                          className="flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {statusOf(r) === "Paid" ? (
                            <CheckCircle2 size={15} className="text-emerald-600" />
                          ) : (
                            <Circle size={15} className="text-gray-300" />
                          )}
                          <Badge tone={STATUS_TONE[statusOf(r)]}>{statusOf(r)}</Badge>
                        </button>
                        {r.paidAt && <p className="text-[10px] font-medium text-gray-400 mt-1">{fmtDate(r.paidAt)}</p>}
                      </td>
                      <td className={`px-4 py-3 font-medium whitespace-nowrap ${overdue ? "text-red-600" : "text-gray-500"}`}>
                        {r.deadlineToRespond ? fmtDate(r.deadlineToRespond) : "—"}
                        {overdue && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider">Overdue</span>}
                      </td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium max-w-[16rem]">
                        <p className="line-clamp-2">{r.claimReason || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <FileStrip files={filesOf(r.files)} onOpen={() => setViewingFiles(r)} />
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onView={() => setViewing(r)}
                          onEdit={() => setModal(r)}
                          onDelete={() => remove(r)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <ViewModal
          row={viewing}
          onClose={() => setViewing(null)}
          onEdit={(row) => { setViewing(null); setModal(row); }}
          // Swap to the viewer rather than stacking it over the detail panel.
          onOpenFiles={(row) => { setViewing(null); setViewingFiles(row); }}
        />
      )}

      {/* Keyed on the claim so opening a different one mounts a fresh viewer,
          which resets it to the first attachment. */}
      {viewingFiles && (
        <MediaViewerModal
          key={viewingFiles._id}
          title={viewingFiles.property}
          subtitle={`Court claim · ${fmtDate(viewingFiles.claimDate)}`}
          files={filesOf(viewingFiles.files)}
          onClose={() => setViewingFiles(null)}
        />
      )}

      {modal !== null && (
        <ClaimModal
          initial={modal._id ? modal : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
