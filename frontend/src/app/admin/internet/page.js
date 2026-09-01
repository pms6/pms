"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import {
  Plus,
  X,
  Wifi,
  Search,
  Download,
  Trash2,
  Loader2,
  Pencil,
  Eye,
  Router,
  Banknote,
  CalendarClock,
  AlertTriangle,
  ImagePlus,
  EyeOff,
} from "lucide-react";
import { PageHeader, StatCard } from "../../Shared/ui";
import api from "../../api/api";
import { uploadFileToCloudinary } from "../../utils/uploadToCloudinary";
import { exportInternetSheet, groupByProvider } from "../../utils/internetSheet";

// MUST stay in sync with INTERNET_PROVIDERS in backend/models/InternetDetail.js.
const PROVIDERS = [
  "Virgin Media",
  "Sky",
  "Community Fiber",
  "BT",
  "TalkTalk",
  "Plusnet",
  "Vodafone",
  "EE",
  "Hyperoptic",
  "Other",
];

// MUST stay in sync with INTERNET_PAYMENT_METHODS in the same model.
const PAYMENT_METHODS = ["", "Direct Debit", "Bank Transfer", "Card", "Cash", "Cheque"];

const money = (n) => `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const toDateInput = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

// How a contract end date reads on the row: already gone, nearly gone, or fine.
const contractTone = (contractEnd) => {
  if (!contractEnd) return null;
  const end = new Date(contractEnd);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  if (end < now) return { label: "Expired", className: "bg-red-100 text-red-700" };

  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  if (end <= in60) return { label: "Ending soon", className: "bg-amber-100 text-amber-700" };

  return null;
};

// A password is only useful if it can be read back, so it is shown on request
// rather than hidden outright — but never by default, because this table gets
// put on a screen in a shared office.
function SecretCell({ value }) {
  const [shown, setShown] = useState(false);

  if (!value) return <span className="text-gray-300">—</span>;

  return (
    <button
      type="button"
      onClick={() => setShown((s) => !s)}
      title={shown ? "Hide" : "Show"}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-[#0F253B] hover:text-[#F47C3C]"
    >
      <span>{shown ? value : "••••••••"}</span>
      {shown ? <EyeOff size={12} /> : <Eye size={12} />}
    </button>
  );
}

function Field({ label, value, span = false, mono = false }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p
        className={`text-sm font-bold text-[#0F253B] mt-1 break-words whitespace-pre-line ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------
function DetailModal({ record, onClose }) {
  const [showPassword, setShowPassword] = useState(false);

  if (!record) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-[#0F253B]">{record.propertyName}</h2>
            <p className="text-sm font-medium text-gray-400">
              {record.providerName}
              {record.providerPhone ? ` · ${record.providerPhone}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Account #" value={record.accountNumber} />
            <Field label="Area Ref" value={record.areaRef} />
            <Field label="Account Holder" value={record.accountHolder} />
            <Field label="Account Email" value={record.accountEmail} />
            <Field label="Contract Start" value={formatDate(record.contractStart)} />
            <Field label="Contract End" value={formatDate(record.contractEnd)} />
            <Field label="Amount" value={money(record.amount)} />
            <Field label="Payment Method" value={record.paymentMethod} />
            <Field label="Company Name" value={record.companyName} />
            <Field label="Bank Name" value={record.bankName} />
            <Field label="Bank Details" value={record.bankDetails} span />
            <Field label="Security Question" value={record.securityQuestion} span />
            <Field label="User Name" value={record.userName} mono />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Password
              </p>
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="mt-1 inline-flex items-center gap-2 font-mono text-sm font-bold text-[#0F253B] hover:text-[#F47C3C]"
              >
                {record.password ? (showPassword ? record.password : "••••••••") : "—"}
                {record.password &&
                  (showPassword ? <EyeOff size={14} /> : <Eye size={14} />)}
              </button>
            </div>
            <Field label="Router Location" value={record.routerLocation} span />
            <Field label="Notes" value={record.notes} span />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Router Photo
            </p>
            {record.routerImage?.url ? (
              <a
                href={record.routerImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={record.routerImage.url}
                  alt={record.routerImage.name || "Router"}
                  className="max-h-72 w-auto rounded-xl border border-gray-100 object-contain bg-gray-50"
                />
              </a>
            ) : (
              <p className="text-sm font-medium text-gray-300">No router photo uploaded.</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / edit form
// ---------------------------------------------------------------------------
function FormModal({ record, properties, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    propertyId: record?.propertyId ? String(record.propertyId) : "",
    propertyName: record?.propertyName || "",
    accountNumber: record?.accountNumber || "",
    areaRef: record?.areaRef || "",
    accountHolder: record?.accountHolder || "",
    providerName: record?.providerName || "",
    providerPhone: record?.providerPhone || "",
    contractStart: toDateInput(record?.contractStart),
    contractEnd: toDateInput(record?.contractEnd),
    amount: record?.amount ?? "",
    paymentMethod: record?.paymentMethod || "",
    companyName: record?.companyName || "",
    bankName: record?.bankName || "",
    bankDetails: record?.bankDetails || "",
    securityQuestion: record?.securityQuestion || "",
    userName: record?.userName || "",
    password: record?.password || "",
    routerLocation: record?.routerLocation || "",
    accountEmail: record?.accountEmail || "",
    notes: record?.notes || "",
  }));

  // Existing photo kept from the record, and any newly chosen replacement.
  const [routerImage, setRouterImage] = useState(record?.routerImage?.url ? record.routerImage : null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Picking a property fills the name; typing a name without picking one is
  // still allowed, for an account on a property not yet in the system.
  const onPropertyChange = (e) => {
    const id = e.target.value;
    const match = properties.find((p) => String(p._id) === id);
    setForm((f) => ({
      ...f,
      propertyId: id,
      propertyName: match ? match.name : f.propertyName,
    }));
  };

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setNewPhoto(file);
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = { ...form };
      payload.amount = form.amount === "" ? 0 : Number(form.amount);

      if (newPhoto) {
        const uploaded = await uploadFileToCloudinary(newPhoto);
        payload.routerImage = { url: uploaded.url, name: uploaded.name || newPhoto.name };
      } else {
        payload.routerImage = routerImage || { url: "", name: "" };
      }

      await onSave(payload);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F47C3C]/40";
  const labelCls = "text-[10px] font-bold text-gray-400 uppercase tracking-widest";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-[#0F253B]">
            {record ? "Edit Internet Details" : "Add Internet Details"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">{error}</div>
          )}

          {/* Property + provider */}
          <div>
            <p className="text-xs font-bold text-[#0F253B] mb-3">Property & Provider</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Property</label>
                <select value={form.propertyId} onChange={onPropertyChange} className={`${input} mt-1`}>
                  <option value="">Not linked — type the name below</option>
                  {properties.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Property Name *</label>
                <input
                  value={form.propertyName}
                  onChange={set("propertyName")}
                  required
                  placeholder="74 Alliance Road, London SE18 2BA"
                  className={`${input} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls}>Provider Name *</label>
                <input
                  value={form.providerName}
                  onChange={set("providerName")}
                  required
                  list="internet-providers"
                  placeholder="Virgin Media"
                  className={`${input} mt-1`}
                />
                <datalist id="internet-providers">
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Provider Phone</label>
                <input
                  value={form.providerPhone}
                  onChange={set("providerPhone")}
                  placeholder="0800 052 1734"
                  className={`${input} mt-1`}
                />
              </div>
            </div>
          </div>

          {/* Account */}
          <div>
            <p className="text-xs font-bold text-[#0F253B] mb-3">Account</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Account #</label>
                <input value={form.accountNumber} onChange={set("accountNumber")} className={`${input} mt-1`} />
              </div>
              <div>
                <label className={labelCls}>Area Ref</label>
                <input value={form.areaRef} onChange={set("areaRef")} className={`${input} mt-1`} />
              </div>
              <div>
                <label className={labelCls}>Account Holder</label>
                <input value={form.accountHolder} onChange={set("accountHolder")} className={`${input} mt-1`} />
              </div>
              <div>
                <label className={labelCls}>Account Email</label>
                <input value={form.accountEmail} onChange={set("accountEmail")} className={`${input} mt-1`} />
              </div>
            </div>
          </div>

          {/* Contract */}
          <div>
            <p className="text-xs font-bold text-[#0F253B] mb-3">Contract</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Contract Start</label>
                <input type="date" value={form.contractStart} onChange={set("contractStart")} className={`${input} mt-1`} />
              </div>
              <div>
                <label className={labelCls}>Contract End</label>
                <input type="date" value={form.contractEnd} onChange={set("contractEnd")} className={`${input} mt-1`} />
              </div>
              <div>
                <label className={labelCls}>Amount (£ / month)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={set("amount")}
                  className={`${input} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls}>Payment Method</label>
                <select value={form.paymentMethod} onChange={set("paymentMethod")} className={`${input} mt-1`}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m || "—"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Billing */}
          <div>
            <p className="text-xs font-bold text-[#0F253B] mb-3">Billing</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Company Name</label>
                <input value={form.companyName} onChange={set("companyName")} className={`${input} mt-1`} />
              </div>
              <div>
                <label className={labelCls}>Bank Name</label>
                <input value={form.bankName} onChange={set("bankName")} className={`${input} mt-1`} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Bank Details</label>
                <textarea
                  value={form.bankDetails}
                  onChange={set("bankDetails")}
                  rows={3}
                  placeholder={"Account number 59600309\nSort code 04 00 04\nIBAN …"}
                  className={`${input} mt-1`}
                />
              </div>
            </div>
          </div>

          {/* Access */}
          <div>
            <p className="text-xs font-bold text-[#0F253B] mb-3">Access</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Security Question</label>
                <textarea
                  value={form.securityQuestion}
                  onChange={set("securityQuestion")}
                  rows={2}
                  placeholder={"Password: …\nDate of Birth: …"}
                  className={`${input} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls}>User Name</label>
                <input value={form.userName} onChange={set("userName")} className={`${input} mt-1 font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input value={form.password} onChange={set("password")} className={`${input} mt-1 font-mono`} />
              </div>
            </div>
          </div>

          {/* Router */}
          <div>
            <p className="text-xs font-bold text-[#0F253B] mb-3">Router</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Router Location</label>
                <input
                  value={form.routerLocation}
                  onChange={set("routerLocation")}
                  placeholder="Room #1 Downstairs"
                  className={`${input} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input value={form.notes} onChange={set("notes")} className={`${input} mt-1`} />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Router Photo</label>
                <div className="mt-2 flex flex-wrap items-start gap-4">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-bold text-[#0F253B] hover:border-[#F47C3C] hover:bg-orange-50/40">
                    <ImagePlus size={16} className="text-[#F47C3C]" />
                    {routerImage?.url || newPhoto ? "Replace photo" : "Upload photo"}
                    <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                  </label>

                  {newPhoto ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(newPhoto)}
                        alt={newPhoto.name}
                        className="h-20 w-20 rounded-xl border border-gray-100 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNewPhoto(null)}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : routerImage?.url ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={routerImage.url}
                        alt={routerImage.name || "Router"}
                        className="h-20 w-20 rounded-xl border border-gray-100 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setRouterImage(null)}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] font-medium text-gray-400">
                  A photo of the router itself — model, serial and the default
                  Wi-Fi details on its label are usually all on one sticker.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-[#F47C3C] text-white font-bold text-sm hover:bg-[#E06D2E] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "Saving…" : record ? "Save Changes" : "Add Record"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function InternetDetailsPage() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [viewing, setViewing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (provider) params.provider = provider;

      const [list, summary] = await Promise.all([
        api.get("/internet-details", { params }),
        api.get("/internet-details/stats"),
      ]);

      setRows(list.data?.data || []);
      setStats(summary.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load internet details.");
    } finally {
      setLoading(false);
    }
  }, [search, provider]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  // Properties feed the "link to a property" select. A failure here is not
  // worth blocking the page for — the form falls back to a typed name.
  useEffect(() => {
    api
      .get("/properties")
      .then((res) => setProperties(res.data?.data || []))
      .catch(() => setProperties([]));
  }, []);

  const save = async (payload) => {
    if (editing) await api.put(`/internet-details/${editing._id}`, payload);
    else await api.post("/internet-details", payload);
    setEditing(undefined);
    await load();
  };

  const remove = async (id) => {
    if (!confirm("Remove this internet record?")) return;
    setBusyId(id);
    try {
      await api.delete(`/internet-details/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove the record.");
    } finally {
      setBusyId(null);
    }
  };

  const groups = groupByProvider(rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internet Details"
        subtitle="Broadband accounts, contracts and router locations for every property"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => exportInternetSheet(rows)}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              <Download size={16} /> Export Sheet
            </button>
            <button
              onClick={() => setEditing(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F47C3C] text-white font-bold text-sm hover:bg-[#E06D2E]"
            >
              <Plus size={16} /> Add Record
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wifi} label="Accounts" value={stats?.totalAccounts ?? "—"} />
        <StatCard
          icon={Banknote}
          label="Monthly Spend"
          value={stats ? money(stats.monthlySpend) : "—"}
        />
        <StatCard
          icon={CalendarClock}
          label="Ending in 60 Days"
          value={stats?.expiringSoon ?? "—"}
        />
        <StatCard icon={AlertTriangle} label="Expired" value={stats?.expired ?? "—"} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[16rem]">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search property, account, holder or router location…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F47C3C]/40"
          />
        </div>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F47C3C]/40"
        >
          <option value="">All providers</option>
          {(stats?.byProvider ? Object.keys(stats.byProvider) : PROVIDERS).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">{error}</div>
      )}

      {/* Sheet */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#F47C3C]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <Wifi className="mx-auto text-gray-300" size={32} />
          <p className="mt-3 text-gray-500 font-medium">
            {search || provider ? "No records match those filters." : "No internet details recorded yet."}
          </p>
          {!search && !provider && (
            <button onClick={() => setEditing(null)} className="mt-3 text-[#F47C3C] font-bold hover:underline">
              Add the first record →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {[
                    "Sr. No",
                    "Property Name",
                    "Account#",
                    "Area Ref",
                    "Account Holder",
                    "Contract Start",
                    "Contract End",
                    "Amount",
                    "Payment Method",
                    "Bank Name",
                    "User Name",
                    "Password",
                    "Router Location",
                    "Router",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.provider}>
                    {/* Provider section heading, as on the original sheet. */}
                    <tr className="bg-orange-50/60">
                      <td colSpan={15} className="px-3 py-2 text-xs font-bold text-[#0F253B]">
                        {group.provider}
                        {group.phone && (
                          <span className="ml-2 font-medium text-gray-500">{group.phone}</span>
                        )}
                        <span className="ml-2 font-medium text-gray-400">
                          ({group.rows.length})
                        </span>
                      </td>
                    </tr>

                    {group.rows.map((row, i) => {
                      const tone = contractTone(row.contractEnd);
                      return (
                        <tr key={row._id} className="border-t border-gray-50 hover:bg-gray-50/60">
                          <td className="px-3 py-3 font-bold text-gray-400">{i + 1}</td>
                          <td className="px-3 py-3 font-bold text-[#0F253B] min-w-[14rem]">
                            {row.propertyName}
                          </td>
                          <td className="px-3 py-3 font-medium whitespace-nowrap">
                            {row.accountNumber || "—"}
                          </td>
                          <td className="px-3 py-3 font-medium">{row.areaRef || "—"}</td>
                          <td className="px-3 py-3 font-medium whitespace-nowrap">
                            {row.accountHolder || "—"}
                          </td>
                          <td className="px-3 py-3 font-medium whitespace-nowrap">
                            {formatDate(row.contractStart)}
                          </td>
                          <td className="px-3 py-3 font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              {formatDate(row.contractEnd)}
                              {tone && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tone.className}`}
                                >
                                  {tone.label}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold whitespace-nowrap">
                            {money(row.amount)}
                          </td>
                          <td className="px-3 py-3 font-medium whitespace-nowrap">
                            {row.paymentMethod || "—"}
                          </td>
                          <td className="px-3 py-3 font-medium">{row.bankName || "—"}</td>
                          <td className="px-3 py-3 font-mono text-xs">{row.userName || "—"}</td>
                          <td className="px-3 py-3">
                            <SecretCell value={row.password} />
                          </td>
                          <td className="px-3 py-3 font-medium min-w-[10rem]">
                            {row.routerLocation || "—"}
                          </td>
                          <td className="px-3 py-3">
                            {row.routerImage?.url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={row.routerImage.url}
                                alt="Router"
                                className="h-10 w-10 rounded-lg border border-gray-100 object-cover"
                              />
                            ) : (
                              <Router size={16} className="text-gray-300" />
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setViewing(row)}
                                title="View"
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => setEditing(row)}
                                title="Edit"
                                className="p-1.5 text-[#0F253B] hover:bg-gray-100 rounded-lg"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => remove(row._id)}
                                disabled={busyId === row._id}
                                title="Remove"
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              >
                                {busyId === row._id ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing !== undefined && (
        <FormModal
          record={editing}
          properties={properties}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}

      <DetailModal record={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
