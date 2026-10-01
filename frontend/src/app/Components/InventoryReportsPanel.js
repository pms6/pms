"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  FileText,
  Search,
  ArrowUp,
  ArrowDown,
  Trash2,
  ClipboardList,
  Download,
  Home,
} from "lucide-react";
import api from "@/app/api/api";
import { Badge } from "@/app/Shared/ui";
import { FIELD, LABEL, ModalShell, ErrorBanner } from "@/app/Shared/registerParts";
import { JOB_TYPES, STATUS_TONE, AREA_LABEL, fmtDate, newKey } from "@/app/utils/inventoryReports";
import { downloadPdf, pdfError } from "@/app/utils/apiPdf";

// The portal this screen is mounted in ("/admin" or "/manager"), so links to
// the editor stay inside it.
export const usePortalBase = () => {
  const pathname = usePathname() || "";
  return `/${pathname.split("/")[1] || "admin"}`;
};

const toInputDate = (d) => {
  const x = d ? new Date(d) : new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// The whole-house layout, in the order the reference report walks a property.
const WHOLE_HOUSE = [
  "FRONT_OF_PROPERTY",
  "ENTRANCE_HALLWAY",
  "RECEPTION",
  "KITCHEN",
  "GARDEN",
  "WC",
  "STAIRWELL",
  "LANDING",
  "BATHROOM",
];

/* ------------------------------------------------------------------ *
 * Start a new report
 * ------------------------------------------------------------------ */
function NewReportModal({ scopes, tenancies, templates, preset = {}, onClose, onCreated }) {
  const [form, setForm] = useState({
    propertyId: preset.propertyId || "",
    roomId: preset.roomId || "",
    tenancyId: preset.tenancyId || "",
    jobType: "Check In",
    inspectionDate: toInputDate(),
    preparedBy: "",
    instructedBy: "",
    propertyType: "",
    seedFromAssetList: true,
  });
  const [areas, setAreas] = useState([]);
  const [addKey, setAddKey] = useState("builtin:BEDROOM");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const property = scopes.find((p) => p._id === form.propertyId);
  const rooms = property?.rooms || [];
  const tenantChoices = tenancies.filter((t) => !form.propertyId || String(t.propertyId || "") === form.propertyId);
  const byKey = useMemo(() => new Map(templates.map((t) => [t.key, t])), [templates]);

  // Picking a tenant fills in their property and room.
  const onTenant = (e) => {
    const t = tenancies.find((x) => String(x._id) === e.target.value);
    setForm((f) => ({
      ...f,
      tenancyId: e.target.value,
      propertyId: t?.propertyId ? String(t.propertyId) : f.propertyId,
      roomId: t?.roomId ? String(t.roomId) : f.roomId,
    }));
  };

  const area = (templateKey, over = {}) => {
    const t = byKey.get(templateKey);
    return { id: newKey(), templateKey, title: over.title || t?.name || "Area", roomId: over.roomId || "", areaType: t?.areaType };
  };

  const addWholeHouse = () => {
    const list = WHOLE_HOUSE.map((k) => area(`builtin:${k}`));
    // One bedroom per room on the property — after the landing, before the
    // bathroom, where the reference walks them.
    const bedrooms = rooms.length
      ? rooms.map((r) => area("builtin:BEDROOM", { title: r.name, roomId: r._id }))
      : [area("builtin:BEDROOM", { title: "Bedroom 1" })];
    list.splice(list.length - 1, 0, ...bedrooms);
    setAreas(list);
  };

  const addSingleRoom = () => {
    const room = rooms.find((r) => r._id === form.roomId);
    setAreas([
      area("builtin:BEDROOM", { title: room?.name || "Bedroom", roomId: form.roomId }),
      area("builtin:EN_SUITE", { title: "En Suite" }),
    ]);
  };

  const move = (i, d) =>
    setAreas((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.propertyId) return setError("Pick the property.");
    if (!areas.length) return setError("Add at least one room or area.");
    setSaving(true);
    try {
      const res = await api.post("/inventory-reports", {
        ...form,
        roomId: form.roomId || null,
        tenancyId: form.tenancyId || null,
        areas: areas.map((a) => ({ templateKey: a.templateKey, title: a.title, roomId: a.roomId || null })),
      });
      onCreated(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start the report.");
      setSaving(false);
    }
  };

  return (
    <ModalShell title="New Inventory Report" subtitle="Pick the property, then build the report room by room" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Job type</label>
            <select className={FIELD} value={form.jobType} onChange={set("jobType")}>
              {JOB_TYPES.map((j) => <option key={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Inspection date</label>
            <input type="date" className={FIELD} value={form.inspectionDate} onChange={set("inspectionDate")} required />
          </div>
        </div>

        <div>
          <label className={LABEL}>Property</label>
          <select className={FIELD} value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value, roomId: "" }))} required>
            <option value="">Select a property…</option>
            {scopes.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Room (optional)</label>
            <select className={FIELD} value={form.roomId} onChange={set("roomId")} disabled={!property}>
              <option value="">Whole property</option>
              {rooms.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tenant (optional)</label>
            <select className={FIELD} value={form.tenancyId} onChange={onTenant}>
              <option value="">No tenant</option>
              {/* A past tenant (opened from their profile) is not in the list of current tenancies. */}
              {form.tenancyId && !tenantChoices.some((t) => String(t._id) === form.tenancyId) && (
                <option value={form.tenancyId}>This tenant</option>
              )}
              {tenantChoices.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.tenant}{t.unit && t.unit !== "—" ? ` — ${t.unit}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Prepared by</label>
            <input className={FIELD} value={form.preparedBy} onChange={set("preparedBy")} placeholder="Inspector" />
          </div>
          <div>
            <label className={LABEL}>Instructed by</label>
            <input className={FIELD} value={form.instructedBy} onChange={set("instructedBy")} placeholder="Agent / landlord" />
          </div>
          <div>
            <label className={LABEL}>Type of property</label>
            <input className={FIELD} value={form.propertyType} onChange={set("propertyType")} placeholder="5x Bedroom House" />
          </div>
        </div>

        {/* Areas */}
        <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className={LABEL + " mb-0"}>Rooms and areas ({areas.length})</p>
            <div className="flex gap-2">
              <button type="button" onClick={addWholeHouse} disabled={!property} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0F253B] text-white disabled:opacity-40">
                <Home size={12} className="inline mr-1" /> Whole house
              </button>
              <button type="button" onClick={addSingleRoom} disabled={!property} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-[#0F253B] disabled:opacity-40">
                Single room
              </button>
            </div>
          </div>

          {areas.length === 0 && (
            <p className="text-xs text-gray-400 font-medium">
              Start from a layout above, or add areas one at a time. Each area begins with the item list from its template, which you can then edit.
            </p>
          )}

          {areas.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-300 w-5 text-right">{i + 1}</span>
              <input
                className={FIELD + " py-2"}
                value={a.title}
                onChange={(e) => setAreas((l) => l.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)))}
              />
              <span className="hidden sm:block text-[10px] font-bold text-gray-400 whitespace-nowrap w-24 truncate" title={byKey.get(a.templateKey)?.name}>
                {byKey.get(a.templateKey)?.name}
              </span>
              <button type="button" onClick={() => move(i, -1)} className="p-1.5 text-gray-400 hover:text-[#0F253B]"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(i, 1)} className="p-1.5 text-gray-400 hover:text-[#0F253B]"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => setAreas((l) => l.filter((x) => x.id !== a.id))} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}

          <div className="flex gap-2">
            <select className={FIELD + " py-2"} value={addKey} onChange={(e) => setAddKey(e.target.value)}>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}{t.builtIn ? "" : " (saved template)"}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setAreas((l) => [...l, area(addKey)])} className="px-3 rounded-xl bg-orange-50 text-[#F47C3C] font-bold text-sm whitespace-nowrap">
              <Plus size={14} className="inline" /> Add
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs font-medium text-gray-600">
          <input type="checkbox" checked={form.seedFromAssetList} onChange={set("seedFromAssetList")} className="mt-0.5" />
          Also bring in the items already on this property&apos;s and rooms&apos; inventory list (with their photos)
        </label>

        <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 text-white font-bold rounded-xl">
          {saving ? "Starting…" : "Start report"}
        </button>
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */
/**
 * Inventory Reports for the whole organisation, or narrowed with
 * `propertyId` / `tenancyIds` when embedded on a property or tenant page.
 * `preset` pre-fills the new-report form in those places.
 */
export default function InventoryReportsPanel({ propertyId = "", tenancyIds = null, preset = null, compact = false }) {
  const router = useRouter();
  const base = usePortalBase();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [jobType, setJobType] = useState("");
  const [status, setStatus] = useState("");
  const [propertyFilter, setPropertyFilter] = useState(propertyId);
  const [scopes, setScopes] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");

  const tenancyKey = tenancyIds ? tenancyIds.join(",") : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { q: q || undefined, jobType: jobType || undefined, status: status || undefined, limit: 200 };
      if (propertyFilter) params.propertyId = propertyFilter;
      if (tenancyKey !== null) params.tenancyIds = tenancyKey || "none";
      const res = await api.get("/inventory-reports", { params });
      setRows(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory reports.");
    } finally {
      setLoading(false);
    }
  }, [q, jobType, status, propertyFilter, tenancyKey]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get("/inventory/scopes").then((r) => setScopes(r.data?.data || [])).catch(() => {});
    api.get("/tenancies").then((r) => setTenancies(r.data?.data || [])).catch(() => {});
    api.get("/inventory-reports/options").then((r) => setTemplates(r.data?.data?.templates || [])).catch(() => {});
  }, []);

  const download = async (r) => {
    setBusy(r._id);
    try {
      await downloadPdf(`/inventory-reports/${r._id}/pdf?download=1`, `${r.jobType}-${r.reference}.pdf`);
    } catch (err) {
      setError(await pdfError(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference, property, room, tenant…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        {!propertyId && !compact && (
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] sm:w-52">
            <option value="">All properties</option>
            {scopes.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
        <select value={jobType} onChange={(e) => setJobType(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] sm:w-40">
          <option value="">All job types</option>
          {JOB_TYPES.map((j) => <option key={j}>{j}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] sm:w-32">
          <option value="">Any status</option>
          <option>Draft</option>
          <option>Final</option>
        </select>
        <button onClick={() => setCreating(true)} className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl">
          <Plus size={16} /> New report
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Property / room</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Inspection</th>
                <th className="px-4 py-3">Areas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <ClipboardList className="inline mb-2 text-gray-300" size={28} />
                    <p className="font-medium">No inventory reports yet</p>
                    <p className="text-xs">Start one to record a check-in or check-out room by room.</p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3">
                      <Link href={`${base}/inventory/reports/${r._id}`} className="font-bold text-[#0F253B] hover:text-[#F47C3C]">{r.reference}</Link>
                      <p className="text-[11px] text-gray-400 font-medium">{r.jobType}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-medium">
                      {r.property}
                      {r.room && <p className="text-[11px] text-gray-400">{r.room}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{r.tenantName || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 font-medium whitespace-nowrap">
                      {fmtDate(r.inspectionDate)}
                      {r.preparedBy && <p className="text-[11px] text-gray-400">{r.preparedBy}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-medium max-w-[16rem]">
                      <p className="font-bold text-[#0F253B]">{r.areaCount} areas · {r.itemCount} items</p>
                      <p className="text-[11px] line-clamp-2">{(r.areas || []).join(", ")}</p>
                    </td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => download(r)} title="Download PDF" className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg">
                          {busy === r._id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        </button>
                        <Link href={`${base}/inventory/reports/${r._id}`} title="Open" className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg">
                          <FileText size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <NewReportModal
          scopes={scopes}
          tenancies={tenancies}
          templates={templates}
          preset={preset || (propertyId ? { propertyId } : {})}
          onClose={() => setCreating(false)}
          onCreated={(r) => router.push(`${base}/inventory/reports/${r._id}`)}
        />
      )}
    </div>
  );
}

export { AREA_LABEL };
