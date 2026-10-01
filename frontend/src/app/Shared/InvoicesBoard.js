"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  X,
  Receipt,
  Trash2,
  Eye,
  Download,
  Printer,
  Send,
  Ban,
  CheckCircle2,
  PoundSterling,
  Pencil,
  Paperclip,
  AlertTriangle,
} from "lucide-react";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";
import { Badge, StatCard } from "./ui";
import { FIELD, LABEL, ErrorBanner } from "./registerParts";
import { MediaUploader, MediaViewerModal, applyFiles } from "./MediaAttachments";
import { guardModalClose } from "./modalGuard";
import {
  INVOICE_STATUSES,
  BILL_TO_TYPES,
  INVOICE_STATUS_TONE,
  PAYMENT_METHODS,
  computeTotals,
  lineNet,
  gbp,
  fmtDate,
} from "@/app/utils/invoices";
import { openPdf, downloadPdf, printPdf, pdfError } from "@/app/utils/apiPdf";

const toInputDate = (d) => {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);

function Shell({ title, subtitle, onClose, wide = false, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className={`w-full ${wide ? "max-w-4xl" : "max-w-lg"} bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] break-words">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 font-medium">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Create / edit
 * ------------------------------------------------------------------ */
function InvoiceFormModal({ initial, options, lookups, preset = {}, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);
  const draft = !isEdit || initial.status === "Draft";
  const today = new Date();
  const [form, setForm] = useState(() => ({
    billToType: initial?.billToType || preset.billToType || "Tenant",
    tenancyId: String(initial?.tenancyId || preset.tenancyId || ""),
    ownerId: String(initial?.ownerId || preset.ownerId || ""),
    billTo: { name: "", email: "", address: "", ...(initial?.billTo || {}) },
    propertyId: String(initial?.propertyId || preset.propertyId || ""),
    caseId: String(initial?.caseId || preset.caseId || ""),
    invoiceDate: toInputDate(initial?.invoiceDate || today),
    dueDate: toInputDate(initial?.dueDate || addDays(today, options.paymentTermsDays ?? 14)),
    lineItems: initial?.lineItems?.length
      ? initial.lineItems.map((l) => ({ ...l }))
      : [{ description: "", quantity: 1, unitPrice: "", vatRate: options.defaultVatRate || 0 }],
    discountType: initial?.discountType || "amount",
    discountValue: initial?.discountValue ?? 0,
    notes: initial?.notes || "",
    terms: initial?.terms || "",
    files: initial?.files || [],
  }));
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  const totals = useMemo(() => computeTotals({ ...form, payments: initial?.payments || [] }), [form, initial?.payments]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBill = (k) => (e) => setForm((f) => ({ ...f, billTo: { ...f.billTo, [k]: e.target.value } }));
  const setLine = (i, k) => (e) => setForm((f) => ({ ...f, lineItems: f.lineItems.map((l, j) => (j === i ? { ...l, [k]: e.target.value } : l)) }));

  // Picking the payer fills in their details; the fields stay editable.
  const pickTenant = (e) => {
    const t = lookups.tenancies.find((x) => String(x._id) === e.target.value);
    setForm((f) => ({
      ...f,
      tenancyId: e.target.value,
      propertyId: t?.propertyId ? String(t.propertyId) : f.propertyId,
      billTo: t
        ? { name: t.tenant || "", email: t.tenantEmail || "", address: [t.unit && t.unit !== "—" ? t.unit : "", t.property].filter(Boolean).join(", ") }
        : f.billTo,
    }));
  };
  const pickOwner = (e) => {
    const o = lookups.owners.find((x) => String(x._id) === e.target.value);
    setForm((f) => ({ ...f, ownerId: e.target.value, billTo: o ? { name: o.name || "", email: o.email || "", address: f.billTo.address } : f.billTo }));
  };

  const cases = lookups.cases.filter((c) => !form.tenancyId || String(c.tenancyId) === form.tenancyId);

  const submit = async (issue) => {
    setError("");
    if (uploading) return setError("Wait for the uploads to finish.");
    setSaving(issue ? "issue" : "save");
    try {
      const body = draft
        ? { ...form, tenancyId: form.tenancyId || null, ownerId: form.ownerId || null, propertyId: form.propertyId || null, caseId: form.caseId || null, issue }
        : { dueDate: form.dueDate, notes: form.notes, terms: form.terms, files: form.files, caseId: form.caseId || null };
      let res = isEdit ? await api.put(`/invoices/${initial._id}`, body) : await api.post("/invoices", body);
      if (isEdit && issue) res = await api.post(`/invoices/${initial._id}/issue`);
      onSaved(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the invoice.");
      setSaving("");
    }
  };

  return (
    <Shell
      wide
      title={isEdit ? `Edit ${initial.number}` : "New Invoice"}
      subtitle={draft ? "The number is assigned automatically" : "Issued — only the due date, notes, terms, case link and attachments can change"}
      onClose={onClose}
    >
      <div className="space-y-5">
        <ErrorBanner>{error}</ErrorBanner>

        <fieldset disabled={!draft} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Bill to</label>
              <select className={FIELD} value={form.billToType} onChange={set("billToType")}>
                {BILL_TO_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            {form.billToType === "Tenant" && (
              <div className="sm:col-span-2">
                <label className={LABEL}>Tenant</label>
                <select className={FIELD} value={form.tenancyId} onChange={pickTenant}>
                  <option value="">Select a tenant…</option>
                  {form.tenancyId && !lookups.tenancies.some((t) => String(t._id) === form.tenancyId) && (
                    <option value={form.tenancyId}>{form.billTo.name || "This tenant"}</option>
                  )}
                  {lookups.tenancies.map((t) => (
                    <option key={t._id} value={String(t._id)}>
                      {t.tenant}{t.property ? ` — ${t.property}` : ""}{t.unit && t.unit !== "—" ? `, ${t.unit}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.billToType === "Landlord" && (
              <div className="sm:col-span-2">
                <label className={LABEL}>Landlord</label>
                <select className={FIELD} value={form.ownerId} onChange={pickOwner}>
                  <option value="">Select a landlord…</option>
                  {lookups.owners.map((o) => <option key={o._id} value={String(o._id)}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Name</label>
              <input className={FIELD} value={form.billTo.name} onChange={setBill("name")} required />
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input type="email" className={FIELD} value={form.billTo.email} onChange={setBill("email")} />
            </div>
            <div>
              <label className={LABEL}>Address</label>
              <input className={FIELD} value={form.billTo.address} onChange={setBill("address")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className={LABEL}>Property</label>
              <select className={FIELD} value={form.propertyId} onChange={set("propertyId")}>
                <option value="">Not property-specific</option>
                {lookups.properties.map((p) => <option key={p._id} value={String(p._id)}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Invoice date</label>
              <input type="date" className={FIELD} value={form.invoiceDate} onChange={set("invoiceDate")} />
            </div>
            <div>
              <label className={LABEL}>Due date</label>
              <input type="date" className={FIELD} value={form.dueDate} onChange={set("dueDate")} disabled={false} />
            </div>
          </div>

          {/* Line items */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-[#0F253B] text-white text-[10px] font-bold uppercase tracking-widest">
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right w-20">Qty</th>
                    <th className="px-3 py-2 text-right w-28">Unit price £</th>
                    <th className="px-3 py-2 text-right w-20">VAT %</th>
                    <th className="px-3 py-2 text-right w-28">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.lineItems.map((l, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1.5"><input className={FIELD + " py-2"} value={l.description} onChange={setLine(i, "description")} placeholder="e.g. Replacement Yale lock — labour and parts" /></td>
                      <td className="px-2 py-1.5"><input type="number" step="any" min="0" className={FIELD + " py-2 text-right"} value={l.quantity} onChange={setLine(i, "quantity")} /></td>
                      <td className="px-2 py-1.5"><input type="number" step="0.01" className={FIELD + " py-2 text-right"} value={l.unitPrice} onChange={setLine(i, "unitPrice")} /></td>
                      <td className="px-2 py-1.5"><input type="number" step="any" min="0" max="100" className={FIELD + " py-2 text-right"} value={l.vatRate} onChange={setLine(i, "vatRate")} /></td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#0F253B]">{gbp(lineNet(l))}</td>
                      <td className="px-1">
                        {form.lineItems.length > 1 && (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, j) => j !== i) }))} className="p-1.5 text-gray-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {draft && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { description: "", quantity: 1, unitPrice: "", vatRate: options.defaultVatRate || 0 }] }))}
                className="m-3 text-xs font-bold text-[#F47C3C] flex items-center gap-1"
              >
                <Plus size={13} /> Add line
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Discount</label>
                <select className={FIELD} value={form.discountType} onChange={set("discountType")}>
                  <option value="amount">Amount (£)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>&nbsp;</label>
                <input type="number" step="any" min="0" className={FIELD} value={form.discountValue} onChange={set("discountValue")} />
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-1">
              {[
                ["Subtotal", totals.subtotal],
                ...(totals.discountAmount ? [["Discount", -totals.discountAmount]] : []),
                ["VAT", totals.vatTotal],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-gray-600 font-medium"><span>{k}</span><span>{gbp(v)}</span></div>
              ))}
              <div className="flex justify-between text-[#0F253B] font-bold text-base pt-1 border-t border-gray-200"><span>Total</span><span>{gbp(totals.total)}</span></div>
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!draft && (
            <div>
              <label className={LABEL}>Due date</label>
              <input type="date" className={FIELD} value={form.dueDate} onChange={set("dueDate")} />
            </div>
          )}
          <div className={draft ? "sm:col-span-2" : ""}>
            <label className={LABEL}>Link to case (optional)</label>
            <select className={FIELD} value={form.caseId} onChange={set("caseId")}>
              <option value="">No case</option>
              {cases.map((c) => <option key={c._id} value={String(c._id)}>{c.ref} — {c.title} ({c.tenantName})</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Notes (printed)</label>
            <textarea className={FIELD} rows={3} value={form.notes} onChange={set("notes")} />
          </div>
          <div>
            <label className={LABEL}>Terms (printed)</label>
            <textarea className={FIELD} rows={3} value={form.terms} onChange={set("terms")} placeholder={`Payment due within ${options.paymentTermsDays ?? 14} days`} />
          </div>
        </div>

        <MediaUploader label="Receipts & supporting documents" files={form.files} onChange={(u) => setForm((f) => ({ ...f, files: applyFiles(u, f.files) }))} onUploadingChange={setUploading} />

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={() => submit(false)} disabled={!!saving} className="flex-1 py-3.5 bg-[#0F253B] text-white font-bold rounded-xl disabled:opacity-50">
            {saving === "save" ? "Saving…" : draft ? "Save draft" : "Save changes"}
          </button>
          {draft && (
            <button type="button" onClick={() => submit(true)} disabled={!!saving} className="flex-1 py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl disabled:opacity-50">
              {saving === "issue" ? "Issuing…" : "Save & issue"}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * One invoice
 * ------------------------------------------------------------------ */
function InvoiceDetailModal({ invoiceId, isAdmin, onClose, onEdit, onChanged }) {
  const [inv, setInv] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [pay, setPay] = useState(null);
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      setInv(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the invoice.");
    }
  }, [invoiceId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const act = async (kind, fn) => {
    setBusy(kind);
    setError("");
    try {
      const res = await fn();
      if (res?.data?.data) setInv(res.data.data);
      if (res?.data?.message) setNotice(res.data.message);
      onChanged();
      return true;
    } catch (err) {
      setError(await pdfError(err, "Something went wrong."));
      return false;
    } finally {
      setBusy("");
    }
  };

  if (!inv) {
    return (
      <Shell title="Invoice" onClose={onClose}>
        {error ? <ErrorBanner>{error}</ErrorBanner> : <Loader2 className="w-6 h-6 animate-spin text-[#F47C3C]" />}
      </Shell>
    );
  }

  const status = inv.effectiveStatus || inv.status;
  const open = ["Issued", "Partially Paid"].includes(inv.status);
  const btn = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50";

  return (
    <Shell wide title={`Invoice ${inv.number}`} subtitle={`${inv.billTo?.name || ""}${inv.property ? ` · ${inv.property}` : ""}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={INVOICE_STATUS_TONE[status]}>{status}</Badge>
          <span className="text-xs text-gray-400 font-medium">
            Dated {fmtDate(inv.invoiceDate)} · due {fmtDate(inv.dueDate)}
            {inv.lastSentAt ? ` · emailed to ${inv.lastSentTo} on ${fmtDate(inv.lastSentAt)}` : ""}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={`${btn} bg-white border border-gray-200 text-[#0F253B]`} disabled={!!busy} onClick={() => act("preview", () => openPdf(`/invoices/${inv._id}/pdf`))}>
            {busy === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} View PDF
          </button>
          <button className={`${btn} bg-white border border-gray-200 text-[#0F253B]`} disabled={!!busy} onClick={() => act("download", () => downloadPdf(`/invoices/${inv._id}/pdf?download=1`, `Invoice-${inv.number}.pdf`))}>
            <Download size={14} /> Download
          </button>
          <button className={`${btn} bg-white border border-gray-200 text-[#0F253B]`} disabled={!!busy} onClick={() => act("print", () => printPdf(`/invoices/${inv._id}/pdf`))}>
            <Printer size={14} /> Print
          </button>
          {inv.status !== "Cancelled" && (
            <button className={`${btn} bg-white border border-gray-200 text-[#0F253B]`} disabled={!!busy} onClick={() => onEdit(inv)}>
              <Pencil size={14} /> Edit
            </button>
          )}
          {inv.status === "Draft" && (
            <button className={`${btn} bg-[#F47C3C] text-white`} disabled={!!busy} onClick={() => act("issue", () => api.post(`/invoices/${inv._id}/issue`))}>
              <CheckCircle2 size={14} /> Issue
            </button>
          )}
          {inv.status !== "Draft" && inv.status !== "Cancelled" && (
            <button
              className={`${btn} bg-[#0F253B] text-white`}
              disabled={!!busy}
              onClick={() => {
                const to = window.prompt("Email the invoice PDF to:", inv.billTo?.email || "");
                if (to) act("send", () => api.post(`/invoices/${inv._id}/send`, { to }));
              }}
            >
              {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Email
            </button>
          )}
          {open && (
            <button className={`${btn} bg-emerald-600 text-white`} disabled={!!busy} onClick={() => setPay({ amount: inv.balance, date: toInputDate(new Date()), method: "Bank Transfer", reference: "", note: "" })}>
              <PoundSterling size={14} /> Record payment
            </button>
          )}
          {open && (
            <button
              className={`${btn} bg-white border border-red-200 text-red-600`}
              disabled={!!busy}
              onClick={() => {
                const reason = window.prompt(`Cancel ${inv.number}? Give a reason (kept in its history):`);
                if (reason !== null) act("cancel", () => api.post(`/invoices/${inv._id}/cancel`, { reason }));
              }}
            >
              <Ban size={14} /> Cancel
            </button>
          )}
          {inv.status === "Draft" && (
            <button
              className={`${btn} bg-white border border-red-200 text-red-600`}
              disabled={!!busy}
              onClick={async () => {
                if (!window.confirm(`Delete draft ${inv.number}?`)) return;
                await act("delete", () => api.delete(`/invoices/${inv._id}`));
                onClose();
              }}
            >
              <Trash2 size={14} /> Delete draft
            </button>
          )}
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {notice && <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-bold rounded">{notice}</div>}

        {pay && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("pay", () => api.post(`/invoices/${inv._id}/payments`, pay)).then((ok) => ok && setPay(null));
            }}
            className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className={LABEL}>Amount £</label>
              <input type="number" step="0.01" min="0.01" className={FIELD + " py-2"} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required />
            </div>
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" className={FIELD + " py-2"} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Method</label>
              <select className={FIELD + " py-2"} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Reference</label>
              <input className={FIELD + " py-2"} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy === "pay"} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Save</button>
              <button type="button" onClick={() => setPay(null)} className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold">×</button>
            </div>
          </form>
        )}

        {/* Lines & totals */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Unit</th>
                <th className="px-4 py-2 text-right">VAT</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lineItems.map((l) => (
                <tr key={l._id} className="border-t border-gray-50">
                  <td className="px-4 py-2 text-gray-700">{l.description}</td>
                  <td className="px-4 py-2 text-right">{l.quantity}</td>
                  <td className="px-4 py-2 text-right">{gbp(l.unitPrice)}</td>
                  <td className="px-4 py-2 text-right">{l.vatRate ? `${l.vatRate}%` : "—"}</td>
                  <td className="px-4 py-2 text-right font-bold">{gbp(lineNet(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-gray-50/60 flex justify-end">
            <div className="w-64 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{gbp(inv.subtotal)}</span></div>
              {inv.discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{gbp(inv.discountAmount)}</span></div>}
              {inv.vatTotal > 0 && <div className="flex justify-between"><span>VAT</span><span>{gbp(inv.vatTotal)}</span></div>}
              <div className="flex justify-between font-bold text-[#0F253B]"><span>Total</span><span>{gbp(inv.total)}</span></div>
              {inv.amountPaid > 0 && <div className="flex justify-between text-emerald-700"><span>Paid</span><span>-{gbp(inv.amountPaid)}</span></div>}
              <div className="flex justify-between font-bold text-[#0F253B] border-t border-gray-200 pt-1"><span>Balance due</span><span>{gbp(inv.balance)}</span></div>
            </div>
          </div>
        </div>

        {inv.payments?.length > 0 && (
          <div>
            <p className={LABEL}>Payments</p>
            <div className="space-y-1.5">
              {inv.payments.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 text-sm bg-gray-50 rounded-xl px-3 py-2">
                  <span className="font-bold text-[#0F253B]">{gbp(p.amount)}</span>
                  <span className="text-gray-500 text-xs flex-1">{fmtDate(p.date)} · {p.method}{p.reference ? ` · ${p.reference}` : ""} · {p.recordedByEmail}</span>
                  {isAdmin && (
                    <button
                      onClick={() => window.confirm("Remove this payment? It will be noted in the invoice history.") && act("rmpay", () => api.delete(`/invoices/${inv._id}/payments/${p._id}`))}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Remove payment"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {inv.files?.length > 0 && (
          <button onClick={() => setViewer(inv.files)} className="text-xs font-bold text-[#F47C3C] flex items-center gap-1">
            <Paperclip size={13} /> {inv.files.length} supporting document{inv.files.length === 1 ? "" : "s"}
          </button>
        )}

        <div>
          <p className={LABEL}>History</p>
          <ul className="space-y-1">
            {(inv.history || []).slice().reverse().map((h, i) => (
              <li key={i} className="text-xs text-gray-500">
                <b className="text-[#0F253B]">{h.action}</b>{h.note ? ` — ${h.note}` : ""} · {new Date(h.at).toLocaleString("en-GB")} · {h.byEmail}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {viewer && <MediaViewerModal title="Supporting documents" files={viewer} onClose={() => setViewer(null)} />}
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */
/**
 * Invoice history for the organisation, or narrowed by `tenancyIds`,
 * `propertyId` or `caseId` when embedded. `preset` pre-fills new invoices.
 */
export default function InvoicesBoard({ tenancyIds = null, propertyId = "", caseId = "", preset = null, compact = false }) {
  const { user } = useAuth();
  const isAdmin = ["OWNER", "ADMIN"].includes(String(user?.organizationRole || "OWNER").toUpperCase());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [billToType, setBillToType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState({ paymentTermsDays: 14, defaultVatRate: 0 });
  const [lookups, setLookups] = useState({ tenancies: [], owners: [], properties: [], cases: [] });
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(null);

  const LIMIT = 50;
  const tenancyKey = tenancyIds ? tenancyIds.join(",") : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { q: q || undefined, status: status || undefined, billToType: billToType || undefined, from: from || undefined, to: to || undefined, page, limit: LIMIT };
      if (tenancyKey !== null) params.tenancyIds = tenancyKey || "none";
      if (propertyId) params.propertyId = propertyId;
      if (caseId) params.caseId = caseId;
      const res = await api.get("/invoices", { params });
      setRows(res.data.data || []);
      setSummary(res.data.summary || {});
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [q, status, billToType, from, to, page, tenancyKey, propertyId, caseId]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get("/invoices/options").then((r) => r.data?.data && setOptions(r.data.data)).catch(() => {});
    Promise.allSettled([
      api.get("/tenancies"),
      api.get("/owners"),
      api.get("/properties", { params: { limit: 200 } }),
      api.get("/tenant-cases", { params: { limit: 200 } }),
    ]).then(([t, o, p, c]) =>
      setLookups({
        tenancies: t.value?.data?.data || [],
        owners: o.value?.data?.data || [],
        properties: p.value?.data?.data || [],
        cases: c.value?.data?.data || [],
      })
    );
  }, []);

  const needsSettings = !options.issuer?.bankName && !options.issuer?.accountNumber;

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Receipt} label="Outstanding" value={gbp(summary.outstanding)} sub={`${summary.count || 0} open invoice${summary.count === 1 ? "" : "s"}`} tone="navy" />
          <StatCard icon={AlertTriangle} label="Overdue" value={gbp(summary.overdue)} sub={`${summary.overdueCount || 0} past due date`} />
          <StatCard icon={Receipt} label="Invoices shown" value={total} />
        </div>
      )}

      {!compact && needsSettings && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-800">
          Your bank / payment details are not set yet, so invoices will print without them. Add them under <b>Account → Invoice &amp; company details</b>.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search number, payer, property, line…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B]">
          <option value="">All statuses</option>
          <option value="Outstanding">Outstanding</option>
          {INVOICE_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {!compact && (
          <>
            <select value={billToType} onChange={(e) => { setBillToType(e.target.value); setPage(1); }} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B]">
              <option value="">Any payer</option>
              {BILL_TO_TYPES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B]" title="From" />
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B]" title="To" />
          </>
        )}
        <button onClick={() => setForm({})} className="lg:ml-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl">
          <Plus size={16} /> New invoice
        </button>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Bill to</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Date / due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400 font-medium">No invoices here</td></tr>
              ) : (
                rows.map((r) => {
                  const s = r.effectiveStatus || r.status;
                  return (
                    <tr key={r._id} onClick={() => setOpenId(r._id)} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer">
                      <td className="px-4 py-3 font-bold text-[#0F253B]">{r.number}</td>
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {r.billTo?.name}
                        <p className="text-[11px] text-gray-400">{r.billToType}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-medium">{r.property || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">
                        {fmtDate(r.invoiceDate)}
                        <p className={`text-[11px] ${s === "Overdue" ? "text-red-600 font-bold" : "text-gray-400"}`}>due {fmtDate(r.dueDate)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#0F253B]">{gbp(r.total)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-600">{r.status === "Cancelled" ? "—" : gbp(r.balance)}</td>
                      <td className="px-4 py-3"><Badge tone={INVOICE_STATUS_TONE[s]}>{s}</Badge></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs font-bold text-gray-500">
            <span>Page {page} of {Math.ceil(total / LIMIT)}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40">Previous</button>
              <button disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {form && (
        <InvoiceFormModal
          initial={form._id ? form : null}
          options={options}
          lookups={lookups}
          preset={preset || { propertyId, caseId }}
          onClose={() => setForm(null)}
          onSaved={(inv) => {
            setForm(null);
            load();
            setOpenId(inv._id);
          }}
        />
      )}
      {openId && !form && (
        <InvoiceDetailModal key={openId} invoiceId={openId} isAdmin={isAdmin} onClose={() => setOpenId(null)} onEdit={(inv) => setForm(inv)} onChanged={load} />
      )}
    </div>
  );
}
