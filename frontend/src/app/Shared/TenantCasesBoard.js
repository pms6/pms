"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  X,
  Briefcase,
  Wrench,
  Mail,
  Receipt,
  Paperclip,
  Send,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";
import { Badge } from "./ui";
import { FIELD, LABEL, ModalShell, ErrorBanner } from "./registerParts";
import { MediaUploader, MediaViewerModal, applyFiles } from "./MediaAttachments";
import { guardModalClose } from "./modalGuard";
import {
  CASE_STATUSES,
  CASE_DONE_STATUSES,
  CASE_CATEGORIES,
  CASE_PRIORITIES,
  CASE_STATUS_TONE,
  CASE_PRIORITY_TONE,
  fmtDateTime,
} from "@/app/utils/tenantCases";

const tenancyLabel = (t) =>
  `${t.tenant}${t.property ? ` — ${t.property}` : ""}${t.unit && t.unit !== "—" ? `, ${t.unit}` : ""}`;

/* ------------------------------------------------------------------ *
 * Open / edit a case
 * ------------------------------------------------------------------ */
function CaseFormModal({ initial, tenancies, members, lockedTenancyId, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    tenancyId: String(initial?.tenancyId || lockedTenancyId || ""),
    category: initial?.category || "Complaint",
    priority: initial?.priority || "Medium",
    status: initial?.status || "Open",
    assignedTo: String(initial?.assignedTo || ""),
    files: initial?.files || [],
    maintenanceIds: (initial?.maintenanceIds || []).map(String),
    emailRecordIds: (initial?.emailRecordIds || []).map(String),
  });
  const [maintenance, setMaintenance] = useState([]);
  const [emails, setEmails] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const tenancy = tenancies.find((t) => String(t._id) === form.tenancyId);

  // What can be linked: this tenant's conversations, and maintenance at their
  // property (their own jobs first).
  useEffect(() => {
    if (!form.tenancyId) return;
    let cancelled = false;
    api.get("/email-records", { params: { tenancyId: form.tenancyId } }).then((r) => !cancelled && setEmails(r.data?.data || [])).catch(() => {});
    api
      .get("/maintenance")
      .then((r) => {
        if (cancelled) return;
        const all = r.data?.data || [];
        const pid = String(tenancy?.propertyId || "");
        setMaintenance(
          all
            .filter((m) => String(m.tenancyId || "") === form.tenancyId || (pid && String(m.propertyId || "") === pid))
            .sort((a, b) => (String(b.tenancyId || "") === form.tenancyId) - (String(a.tenancyId || "") === form.tenancyId))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.tenancyId, tenancy?.propertyId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k, id) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (uploading) return setError("Wait for the uploads to finish.");
    setSaving(true);
    try {
      const res = isEdit ? await api.put(`/tenant-cases/${initial._id}`, form) : await api.post("/tenant-cases", form);
      onSaved(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the case.");
      setSaving(false);
    }
  };

  return (
    <ModalShell title={isEdit ? `Edit ${initial.ref}` : "Open a Case"} subtitle="One issue with one tenant, tracked to close" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        <div>
          <label className={LABEL}>Tenant</label>
          {/* Opened from a tenant's profile (or editing), the tenant is fixed —
              and may be a past tenant, whose ended tenancy is not in the
              picker's list — so it is shown rather than picked. */}
          {lockedTenancyId || isEdit ? (
            <p className={FIELD + " bg-gray-100"}>
              {tenancy ? tenancyLabel(tenancy) : initial?.tenantName || "This tenant"}
            </p>
          ) : (
            <select className={FIELD} value={form.tenancyId} onChange={set("tenancyId")} required>
              <option value="">Select a tenant…</option>
              {tenancies.map((t) => <option key={t._id} value={String(t._id)}>{tenancyLabel(t)}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className={LABEL}>Title / subject</label>
          <input className={FIELD} value={form.title} onChange={set("title")} placeholder="e.g. Noise complaint from Room 3" required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Category</label>
            <select className={FIELD} value={form.category} onChange={set("category")}>
              {CASE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Priority</label>
            <select className={FIELD} value={form.priority} onChange={set("priority")}>
              {CASE_PRIORITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className={FIELD} value={form.status} onChange={set("status")}>
              {CASE_STATUSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Assigned to</label>
          <select className={FIELD} value={form.assignedTo} onChange={set("assignedTo")}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={String(m.userId)} value={String(m.userId)}>
                {m.email}{m.role ? ` (${m.role.toLowerCase()})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <textarea className={FIELD} rows={4} value={form.description} onChange={set("description")} />
        </div>
        <MediaUploader label="Evidence" files={form.files} onChange={(u) => setForm((f) => ({ ...f, files: applyFiles(u, f.files) }))} onUploadingChange={setUploading} />

        {form.tenancyId && (
          <div className="grid grid-cols-1 gap-3">
            <details className="border border-gray-100 rounded-xl p-3" open={form.maintenanceIds.length > 0}>
              <summary className="text-xs font-bold text-[#0F253B] cursor-pointer">
                <Wrench size={12} className="inline mr-1 text-[#F47C3C]" /> Linked maintenance ({form.maintenanceIds.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {maintenance.length === 0 && <p className="text-xs text-gray-400">No maintenance at this property.</p>}
                {maintenance.map((m) => (
                  <label key={m._id} className="flex items-start gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={form.maintenanceIds.includes(String(m._id))} onChange={() => toggle("maintenanceIds", String(m._id))} className="mt-0.5" />
                    <span><b>{m.ref || "—"}</b> {m.title} · {m.status}{m.room ? ` · ${m.room}` : ""}</span>
                  </label>
                ))}
              </div>
            </details>
            <details className="border border-gray-100 rounded-xl p-3" open={form.emailRecordIds.length > 0}>
              <summary className="text-xs font-bold text-[#0F253B] cursor-pointer">
                <Mail size={12} className="inline mr-1 text-[#F47C3C]" /> Linked communications ({form.emailRecordIds.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {emails.length === 0 && <p className="text-xs text-gray-400">No communications logged with this tenant.</p>}
                {emails.map((r) => (
                  <label key={r._id} className="flex items-start gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={form.emailRecordIds.includes(String(r._id))} onChange={() => toggle("emailRecordIds", String(r._id))} className="mt-0.5" />
                    <span><b>{r.channel}</b> {r.subject || r.issue} · {new Date(r.date).toLocaleDateString("en-GB")}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        )}

        <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 text-white font-bold rounded-xl">
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Open Case"}
        </button>
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * One case — its details, links and full activity history
 * ------------------------------------------------------------------ */
function CaseDetailModal({ caseId, members, isAdmin, onClose, onEdit, onChanged, onDeleted }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [nextStatus, setNextStatus] = useState("");
  const [uploading, setUploading] = useState(0);
  const [posting, setPosting] = useState(false);
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/tenant-cases/${caseId}`);
      setRow(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the case.");
    }
  }, [caseId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const quick = async (body) => {
    try {
      await api.put(`/tenant-cases/${caseId}`, body);
      await load();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update the case.");
    }
  };

  const post = async (e) => {
    e.preventDefault();
    if (uploading) return;
    setPosting(true);
    setError("");
    try {
      await api.post(`/tenant-cases/${caseId}/activity`, { text: note, files, ...(nextStatus ? { status: nextStatus } : {}) });
      setNote("");
      setFiles([]);
      setNextStatus("");
      await load();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add the note.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${row.ref}? Close it instead if the issue is finished.`)) return;
    try {
      await api.delete(`/tenant-cases/${caseId}`);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {!row ? (
          <div className="p-10 text-center">
            {error ? <p className="text-red-600 font-bold">{error}</p> : <Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" />}
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-400">{row.ref} · {row.category}</p>
                  <h3 className="text-xl font-bold text-[#0F253B] break-words">{row.title}</h3>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    {row.tenantName}{row.property ? ` · ${row.property}` : ""}{row.room ? ` · ${row.room}` : ""} · opened {fmtDateTime(row.createdAt)}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge tone={CASE_STATUS_TONE[row.status]}>{row.status}</Badge>
                    <Badge tone={CASE_PRIORITY_TONE[row.priority]}>{row.priority}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEdit(row)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg" title="Edit"><Pencil size={16} /></button>
                  {isAdmin && <button onClick={remove} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={16} /></button>}
                  <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-500"><X size={20} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className={LABEL}>Status</label>
                  <select className={FIELD + " py-2"} value={row.status} onChange={(e) => quick({ status: e.target.value })}>
                    {CASE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Assigned to</label>
                  <select className={FIELD + " py-2"} value={String(row.assignedTo || "")} onChange={(e) => quick({ assignedTo: e.target.value || null })}>
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={String(m.userId)} value={String(m.userId)}>{m.email}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {error && <ErrorBanner>{error}</ErrorBanner>}
              {row.description && <p className="text-sm text-gray-700 whitespace-pre-line">{row.description}</p>}

              {row.files?.length > 0 && (
                <button onClick={() => setViewer({ title: "Evidence", files: row.files })} className="text-xs font-bold text-[#F47C3C] flex items-center gap-1">
                  <Paperclip size={13} /> {row.files.length} evidence file{row.files.length === 1 ? "" : "s"}
                </button>
              )}

              {/* Linked records */}
              {(row.linked?.maintenance?.length > 0 || row.linked?.emailRecords?.length > 0 || row.linked?.invoices?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ["Maintenance", Wrench, row.linked.maintenance, (m) => `${m.ref || ""} ${m.title} · ${m.status}`],
                    ["Communications", Mail, row.linked.emailRecords, (r) => `${r.channel}: ${r.subject || r.issue} · ${r.status}`],
                    ["Invoices", Receipt, row.linked.invoices, (i) => `${i.number} · £${i.total} · ${i.status}`],
                  ].map(([label, Icon, list, fmt]) =>
                    list?.length ? (
                      <div key={label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 mb-1"><Icon size={11} /> {label}</p>
                        {list.map((x) => <p key={x._id} className="text-xs text-gray-600 font-medium">{fmt(x)}</p>)}
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* History */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">History</p>
                <ol className="relative border-l-2 border-gray-100 ml-2 space-y-4">
                  {(row.activity || []).map((a) => (
                    <li key={a._id} className="ml-4">
                      <span className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full ${a.kind === "note" ? "bg-[#F47C3C]" : a.kind === "status" ? "bg-[#0F253B]" : "bg-gray-300"}`} />
                      <p className="text-[11px] text-gray-400 font-medium">{fmtDateTime(a.createdAt)} · {a.authorEmail}</p>
                      {a.status && <Badge tone={CASE_STATUS_TONE[a.status]}>{a.status}</Badge>}
                      {a.text && <p className={`text-sm mt-0.5 whitespace-pre-line ${a.kind === "note" ? "text-gray-800" : "text-gray-500"}`}>{a.text}</p>}
                      {a.files?.length > 0 && (
                        <button onClick={() => setViewer({ title: "Note attachments", files: a.files })} className="text-xs font-bold text-[#F47C3C] mt-1 flex items-center gap-1">
                          <Paperclip size={12} /> {a.files.length} attachment{a.files.length === 1 ? "" : "s"}
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Add a note */}
              <form onSubmit={post} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <textarea className={FIELD + " bg-white"} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note — what happened, what was agreed, next step…" />
                <MediaUploader label="Evidence" files={files} onChange={setFiles} onUploadingChange={setUploading} />
                <div className="flex gap-2 items-center flex-wrap">
                  <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600">
                    <option value="">Keep status ({row.status})</option>
                    {CASE_STATUSES.filter((s) => s !== row.status).map((s) => <option key={s} value={s}>Move to {s}</option>)}
                  </select>
                  <button type="submit" disabled={posting || uploading > 0 || (!note.trim() && !files.length && !nextStatus)} className="ml-auto px-4 py-2 rounded-xl bg-[#F47C3C] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                    {posting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Add to case
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
      {viewer && <MediaViewerModal title={viewer.title} files={viewer.files} onClose={() => setViewer(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */
/**
 * Tenant cases. Organisation-wide on the Cases page; pass `tenancyIds` (and
 * `tenancyId` for new cases) to show one tenant's cases on their profile.
 */
export default function TenantCasesBoard({ tenancyIds = null, tenancyId = "", compact = false }) {
  const { user } = useAuth();
  const isAdmin = ["OWNER", "ADMIN"].includes(String(user?.organizationRole || "OWNER").toUpperCase());
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(compact ? "" : "open");
  const [category, setCategory] = useState("");
  const [mine, setMine] = useState(false);
  const [tenancies, setTenancies] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(null);

  const tenancyKey = tenancyIds ? tenancyIds.join(",") : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { q: q || undefined, status: status || undefined, category: category || undefined, mine: mine ? "1" : undefined, limit: 200 };
      if (tenancyKey !== null) params.tenancyIds = tenancyKey || "none";
      const res = await api.get("/tenant-cases", { params });
      setRows(res.data.data || []);
      setCounts(res.data.statusCounts || {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load cases.");
    } finally {
      setLoading(false);
    }
  }, [q, status, category, mine, tenancyKey]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // A notification click lands here with ?open=<caseId>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("open");
    if (id && !compact) {
      (async () => setOpenId(id))();
      params.delete("open");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, [compact]);

  useEffect(() => {
    api.get("/tenancies").then((r) => setTenancies(r.data?.data || [])).catch(() => {});
    api.get("/tasks/assignable-members").then((r) => setMembers(r.data?.data || [])).catch(() => {});
  }, []);

  const openCount = useMemo(
    () => Object.entries(counts).filter(([s]) => !CASE_DONE_STATUSES.includes(s)).reduce((n, [, v]) => n + v, 0),
    [counts]
  );

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {CASE_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? "open" : s)}
              className={`text-left bg-white border rounded-2xl p-4 transition-all ${status === s ? "border-[#F47C3C] ring-2 ring-orange-100" : "border-gray-100"}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s}</p>
              <p className="text-2xl font-bold text-[#0F253B]">{counts[s] || 0}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search case, tenant, property, notes…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B]">
          <option value="open">Open cases ({openCount})</option>
          <option value="">All cases</option>
          {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B]">
          <option value="">All categories</option>
          {CASE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        {!compact && (
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me
          </label>
        )}
        <button onClick={() => setForm({})} className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl">
          <Plus size={16} /> Open case
        </button>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Case</th>
                {!compact && <th className="px-4 py-3">Tenant</th>}
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <Briefcase className="inline mb-2 text-gray-300" size={26} />
                    <p className="font-medium">No cases here</p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} onClick={() => setOpenId(r._id)} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer align-top">
                    <td className="px-4 py-3 min-w-[14rem]">
                      <p className="font-bold text-[#0F253B]">{r.title}</p>
                      <p className="text-[11px] text-gray-400 font-medium">{r.ref} · <Badge tone={CASE_PRIORITY_TONE[r.priority]}>{r.priority}</Badge></p>
                    </td>
                    {!compact && (
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {r.tenantName}
                        <p className="text-[11px] text-gray-400">{[r.property, r.room].filter(Boolean).join(" · ")}</p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600 font-medium">{r.category}</td>
                    <td className="px-4 py-3"><Badge tone={CASE_STATUS_TONE[r.status]}>{r.status}</Badge></td>
                    <td className="px-4 py-3 text-gray-500 font-medium text-xs">
                      {r.assignedToEmail ? <span className="flex items-center gap-1"><UserRound size={12} /> {r.assignedToEmail}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[18rem]">
                      <p className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDateTime(r.updatedAt)}</p>
                      <p className="text-xs line-clamp-2">{r.lastActivity?.text}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <CaseFormModal
          initial={form}
          tenancies={tenancies}
          members={members}
          lockedTenancyId={tenancyId}
          onClose={() => setForm(null)}
          onSaved={(c) => {
            setForm(null);
            load();
            setOpenId(c._id);
          }}
        />
      )}

      {openId && !form && (
        <CaseDetailModal
          key={openId}
          caseId={openId}
          members={members}
          isAdmin={isAdmin}
          onClose={() => setOpenId(null)}
          onEdit={(c) => setForm(c)}
          onChanged={load}
          onDeleted={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
