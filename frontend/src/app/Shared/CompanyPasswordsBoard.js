"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
  Lock,
  Globe,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import api from "@/app/api/api";
import { guardModalClose } from "@/app/Shared/modalGuard";
import {
  MediaUploader,
  MediaViewerModal,
  previewKind,
} from "@/app/Shared/MediaAttachments";

/* ------------------------------------------------------------------ *
 * Company Passwords — one section, two sheets:
 *   ACCOUNT  "Company Accounts [TMH LTD]"  — logins + domains
 *   KEYSAFE  "Keysafe Codes"               — key-safe & digital-lock codes
 * Each type has its own form and its own columns.
 * MUST stay in sync with PASSWORD_TYPES in backend/models/CompanyPassword.js.
 * ------------------------------------------------------------------ */

export const PASSWORD_TYPES = ["ACCOUNT", "KEYSAFE"];

const TABS = [
  { type: "ACCOUNT", label: "Company Accounts", icon: Globe },
  { type: "KEYSAFE", label: "Keysafe Codes", icon: KeyRound },
];

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
};

const toInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// How soon a domain renewal counts as "due soon".
const DUE_SOON_DAYS = 30;
const dueTone = (v) => {
  if (!v) return null;
  const days = (new Date(v).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "red";
  if (days <= DUE_SOON_DAYS) return "amber";
  return null;
};

/* ------------------------------------------------------------------ *
 * A secret value — hidden until revealed, with a copy button.
 * ------------------------------------------------------------------ */
function Secret({ value }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value) return <span className="text-gray-300 font-medium">—</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — nothing useful to do */
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[13px] text-[#0F253B]">
        {shown ? value : "•".repeat(Math.min(value.length, 10))}
      </span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        title={shown ? "Hide" : "Reveal"}
        className="text-gray-400 hover:text-[#0F253B]"
      >
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        onClick={copy}
        title="Copy"
        className="text-gray-400 hover:text-[#0F253B]"
      >
        {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * A masked text input with a reveal toggle — for the forms.
 * ------------------------------------------------------------------ */
function SecretInput({ value, onChange, placeholder }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        type={shown ? "text" : "password"}
        className={`${FIELD} pr-10 font-mono`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0F253B]"
        title={shown ? "Hide" : "Show"}
      >
        {shown ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Form 1 — Company Account
 * ------------------------------------------------------------------ */
function AccountModal({ initial, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState({
    accountName: initial?.accountName || "",
    userId: initial?.userId || "",
    password: initial?.password || "",
    domain: initial?.domain || "",
    domainDueDate: toInputDate(initial?.domainDueDate),
    site: initial?.site || "",
    notes: initial?.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.accountName.trim()) { setError("Account name is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        type: "ACCOUNT",
        accountName: form.accountName.trim(),
        userId: form.userId.trim(),
        password: form.password,
        domain: form.domain.trim(),
        domainDueDate: form.domainDueDate || "",
        site: form.site.trim(),
        notes: form.notes.trim(),
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={isEdit ? "Edit Company Account" : "New Company Account"} subtitle="A login the company holds, and its domain" onClose={onClose}>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={LABEL}>Account</label>
          <input className={FIELD} value={form.accountName} onChange={set("accountName")} placeholder="e.g. GoDaddy, Google Workspace" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>User ID / Email</label>
            <input className={FIELD} value={form.userId} onChange={set("userId")} placeholder="login@tmhltd.co.uk" autoComplete="off" />
          </div>
          <div>
            <label className={LABEL}>Password</label>
            <SecretInput value={form.password} onChange={set("password")} placeholder="Password" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Domain</label>
            <input className={FIELD} value={form.domain} onChange={set("domain")} placeholder="tmhltd.co.uk" />
          </div>
          <div>
            <label className={LABEL}>Due date of domain</label>
            <input type="date" className={FIELD} value={form.domainDueDate} onChange={set("domainDueDate")} />
          </div>
        </div>
        <div>
          <label className={LABEL}>Site</label>
          <input className={FIELD} value={form.site} onChange={set("site")} placeholder="https://…" />
        </div>
        <div>
          <label className={LABEL}>Notes</label>
          <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="2FA, recovery details, anything to flag…" />
        </div>
        <SubmitButton saving={saving} isEdit={isEdit} />
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Form 2 — Keysafe Codes
 * ------------------------------------------------------------------ */
function KeysafeModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    keysCode: initial?.keysCode || "",
    digitalLockCode: initial?.digitalLockCode || "",
    lockLocation: initial?.lockLocation || "",
    media: Array.isArray(initial?.media) ? initial.media : [],
    notes: initial?.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Saving mid-upload would store the row without the file still going up, so
  // the submit button waits for the batch to land.
  const [uploading, setUploading] = useState(0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // MediaUploader hands back an updater so files landing at the same time each
  // append to the latest list rather than to the one captured when it started.
  const setMedia = (updater) =>
    setForm((f) => ({ ...f, media: typeof updater === "function" ? updater(f.media) : updater }));

  const onPropertyPick = (e) => {
    const propertyId = e.target.value;
    const name = properties.find((p) => p._id === propertyId)?.name || "";
    setForm((f) => ({ ...f, propertyId, property: name || f.property }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    if (uploading > 0) { setError("Wait for the uploads to finish"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        type: "KEYSAFE",
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        keysCode: form.keysCode,
        digitalLockCode: form.digitalLockCode,
        lockLocation: form.lockLocation.trim(),
        media: form.media,
        notes: form.notes.trim(),
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={isEdit ? "Edit Keysafe Codes" : "New Keysafe Codes"} subtitle="Key-safe and digital-lock codes for a property" onClose={onClose}>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={LABEL}>Pick from portfolio</label>
          <select className={FIELD} value={form.propertyId} onChange={onPropertyPick}>
            <option value="">Not linked — type the address below</option>
            {properties.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Property</label>
          <input className={FIELD} value={form.property} onChange={set("property")} placeholder="e.g. 28 Babington Road NW4 4LD" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Keys code</label>
            <input
              type="text"
              className={`${FIELD} font-mono`}
              value={form.keysCode}
              onChange={set("keysCode")}
              placeholder="Key-safe combination"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={LABEL}>Digital lock code</label>
            <input
              type="text"
              className={`${FIELD} font-mono`}
              value={form.digitalLockCode}
              onChange={set("digitalLockCode")}
              placeholder="Door keypad code"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label className={LABEL}>Lock location</label>
          <input className={FIELD} value={form.lockLocation} onChange={set("lockLocation")} placeholder="e.g. Left of front door, black box" />
        </div>
        <div>
          <MediaUploader
            files={form.media}
            onChange={setMedia}
            onUploadingChange={setUploading}
            accept="image/*,video/*"
            label="Photos & Videos"
            hint="Drop photos or videos here, or click to choose — the key-safe, where it sits, how it opens"
          />
        </div>
        <div>
          <label className={LABEL}>Notes</label>
          <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Anything to flag…" />
        </div>
        <SubmitButton saving={saving} uploading={uploading > 0} isEdit={isEdit} />
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">{title}</h3>
            <p className="text-xs text-gray-400 font-medium">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// `uploading` blocks the save without claiming to be saving — a row stored
// mid-upload would be missing the file that is still going up.
function SubmitButton({ saving, isEdit, uploading = false }) {
  return (
    <button
      type="submit"
      disabled={saving || uploading}
      className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]"
    >
      {saving ? "Saving…" : uploading ? "Uploading…" : isEdit ? "Save Changes" : "Add Entry"}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */
export default function CompanyPasswordsBoard({
  subtitle = "Company account logins and property key-safe codes, in one place",
}) {
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("ACCOUNT");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {} = create, row = edit
  // The keysafe row whose photos and videos are open in the viewer.
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, propsRes] = await Promise.all([
        api.get("/company-passwords"),
        api.get("/properties", { params: { limit: 200 } }),
      ]);
      setRows(listRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load company passwords");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { ACCOUNT: 0, KEYSAFE: 0 };
    for (const r of rows) if (c[r.type] !== undefined) c[r.type]++;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => r.type === tab)
      .filter((r) =>
        needle
          ? [
              r.accountName, r.userId, r.domain, r.site,
              r.property, r.lockLocation, r.notes,
            ].some((v) => String(v || "").toLowerCase().includes(needle))
          : true
      );
  }, [rows, tab, q]);

  const save = async (payload) => {
    if (modal?._id) await api.put(`/company-passwords/${modal._id}`, payload);
    else await api.post("/company-passwords", payload);
    setModal(null);
    await load();
  };

  const remove = async (row) => {
    const label = row.type === "ACCOUNT" ? row.accountName : row.property;
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/company-passwords/${row._id}`);
      await load();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const ActiveTab = TABS.find((t) => t.type === tab);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Company Passwords"
        subtitle={subtitle}
        action={
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> New {tab === "ACCOUNT" ? "Account" : "Keysafe"}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={load} className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold">Retry</button>
        </div>
      )}

      {/* The two sheets — one tab each. */}
      <div className="flex gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.type;
          return (
            <button
              key={t.type}
              onClick={() => { setTab(t.type); setQ(""); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                active
                  ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              }`}
            >
              <Icon size={15} className={active ? "text-[#F47C3C]" : "text-gray-400"} />
              {t.label}
              <span className={`text-[11px] font-bold ${active ? "text-white/60" : "text-gray-400"}`}>
                {loading ? "" : counts[t.type]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "ACCOUNT" ? "Search account, email, domain…" : "Search property, location…"}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
            <Lock size={15} className="text-[#F47C3C]" />
            {tab === "ACCOUNT" ? "Company Accounts [TMH LTD]" : "Keysafe Codes"}
          </p>
        </div>

        <div className="overflow-x-auto">
          {tab === "ACCOUNT" ? (
            <AccountTable rows={visible} loading={loading} onEdit={setModal} onDelete={remove} />
          ) : (
            <KeysafeTable rows={visible} loading={loading} onEdit={setModal} onDelete={remove} onView={setViewing} />
          )}
        </div>
      </div>

      {modal !== null && tab === "ACCOUNT" && (
        <AccountModal
          initial={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
      {modal !== null && tab === "KEYSAFE" && (
        <KeysafeModal
          initial={modal._id ? modal : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {viewing && (
        // Keyed on the row so opening a different property mounts a fresh
        // viewer at its first file rather than at whatever index was left over.
        <MediaViewerModal
          key={viewing._id}
          title={viewing.property}
          subtitle="Key-safe photos and videos"
          files={viewing.media || []}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function RowActions({ row, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => onEdit(row)} title="Edit" className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
      <button onClick={() => onDelete(row)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
    </div>
  );
}

function Empty({ colSpan, loading, has }) {
  if (loading) {
    return (
      <tr><td colSpan={colSpan} className="px-5 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
    );
  }
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-14 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-[#F47C3C] flex items-center justify-center mb-3 mx-auto">
          <Lock size={22} />
        </div>
        <p className="text-gray-500 font-medium">{has ? "Nothing matches that search" : "No entries yet"}</p>
        <p className="text-sm text-gray-400 mt-1">Add one with the button above.</p>
      </td>
    </tr>
  );
}

function AccountTable({ rows, loading, onEdit, onDelete }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
          <th className="px-4 py-3 w-10">#</th>
          <th className="px-4 py-3">Accounts</th>
          <th className="px-4 py-3">User ID / Email</th>
          <th className="px-4 py-3">Password</th>
          <th className="px-4 py-3">Domain</th>
          <th className="px-4 py-3 w-36">Domain Due Date</th>
          <th className="px-4 py-3">Site</th>
          <th className="px-4 py-3 w-24 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading || rows.length === 0 ? (
          <Empty colSpan={8} loading={loading} has={rows.length === 0} />
        ) : (
          rows.map((r, i) => {
            const tone = dueTone(r.domainDueDate);
            return (
              <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
                <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#0F253B]">{r.accountName}</p>
                  {r.notes && <p className="text-[11px] font-medium text-gray-400 max-w-xs">{r.notes}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600 font-medium break-all">{r.userId || "—"}</td>
                <td className="px-4 py-3"><Secret value={r.password} /></td>
                <td className="px-4 py-3 text-gray-600 font-medium break-all">{r.domain || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.domainDueDate ? (
                    tone ? (
                      <Badge tone={tone}>{fmtDate(r.domainDueDate)}</Badge>
                    ) : (
                      <span className="text-gray-600 font-medium">{fmtDate(r.domainDueDate)}</span>
                    )
                  ) : (
                    <span className="text-gray-300 font-medium">—</span>
                  )}
                </td>
                <td className="px-4 py-3 break-all">
                  {r.site ? (
                    <a href={/^https?:\/\//.test(r.site) ? r.site : `https://${r.site}`} target="_blank" rel="noopener noreferrer" className="text-[#F47C3C] font-medium hover:underline">
                      {r.site}
                    </a>
                  ) : (
                    <span className="text-gray-300 font-medium">—</span>
                  )}
                </td>
                <td className="px-4 py-3"><RowActions row={r} onEdit={onEdit} onDelete={onDelete} /></td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

/**
 * The attachments on a keysafe row, as a strip of thumbnails that opens the
 * shared viewer. Photos of where the box sits are only useful if they can be
 * looked at from the table — the edit form is the wrong place to go browsing.
 */
function MediaCell({ row, onView }) {
  const media = Array.isArray(row.media) ? row.media : [];
  if (media.length === 0) return <span className="text-gray-300 font-medium">—</span>;

  const shown = media.slice(0, 3);
  const rest = media.length - shown.length;

  return (
    <button
      type="button"
      onClick={() => onView(row)}
      title={`View ${media.length} ${media.length === 1 ? "attachment" : "attachments"}`}
      className="inline-flex items-center gap-1.5 group"
    >
      {shown.map((item, i) => (
        <span
          key={(item.url || "") + i}
          className="relative w-8 h-8 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center"
        >
          {previewKind(item) === "image" ? (
            <img src={item.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film size={13} className="text-gray-400" />
          )}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[11px] font-bold text-gray-400">+{rest}</span>
      )}
      <ImageIcon
        size={13}
        className="text-gray-300 group-hover:text-[#F47C3C] transition-colors"
      />
    </button>
  );
}

function KeysafeTable({ rows, loading, onEdit, onDelete, onView }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
          <th className="px-4 py-3 w-10">#</th>
          <th className="px-4 py-3">Property</th>
          <th className="px-4 py-3">Keys Code</th>
          <th className="px-4 py-3">Digital Lock Code</th>
          <th className="px-4 py-3">Lock Location</th>
          <th className="px-4 py-3">Media</th>
          <th className="px-4 py-3 w-24 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading || rows.length === 0 ? (
          <Empty colSpan={7} loading={loading} has={rows.length === 0} />
        ) : (
          rows.map((r, i) => (
            <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
              <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-[#0F253B]">{r.property}</p>
                {r.notes && <p className="text-[11px] font-medium text-gray-400 max-w-xs">{r.notes}</p>}
              </td>
              <td className="px-4 py-3"><Secret value={r.keysCode} /></td>
              <td className="px-4 py-3"><Secret value={r.digitalLockCode} /></td>
              <td className="px-4 py-3 text-gray-600 font-medium">{r.lockLocation || "—"}</td>
              <td className="px-4 py-3"><MediaCell row={r} onView={onView} /></td>
              <td className="px-4 py-3"><RowActions row={r} onEdit={onEdit} onDelete={onDelete} /></td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
