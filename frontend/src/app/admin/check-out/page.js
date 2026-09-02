"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Download, LogOut, KeyRound, ClipboardCheck } from "lucide-react";
import { PageHeader, StatCard, Badge } from "../../Shared/ui";
import api from "../../api/api";
import CheckOutFormModal from "../_components/CheckOutFormModal";
import RecordDetail from "../_components/RecordDetail";
import RowActions from "../_components/RowActions";
import {
  money,
  date,
  ordinal,
  MONTHS,
  yearOptions,
  DEPOSIT_STATUSES,
  DEPOSIT_STATUS_LABEL,
  DEPOSIT_STATUS_TONE,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  INSPECTION_STATUSES,
  INSPECTION_LABEL,
  INSPECTION_TONE,
  CHECKLIST,
  checklistScore,
  exportCsv,
  exportRowCsv,
} from "../../utils/registers";

const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

// The register's columns, defined once so the full export and a single-row
// download can never describe a check-out differently.
const COLUMNS = [
  { header: "Property", value: (r) => r.property },
  { header: "Room", value: (r) => r.room },
  { header: "Tenants Name", value: (r) => r.tenant },
  { header: "Deposit Status", value: (r) => DEPOSIT_STATUS_LABEL[r.depositStatus] || r.depositStatus },
  { header: "Deposit Note", value: (r) => r.depositNote },
  { header: "Returned", value: (r) => r.depositReturned },
  { header: "Deducted", value: (r) => r.depositDeducted },
  { header: "Contract", value: (r) => CONTRACT_STATUS_LABEL[r.contractStatus] || r.contractStatus },
  { header: "Due Date", value: (r) => r.rentDueDay ?? "" },
  { header: "Notice Date", value: (r) => date(r.noticeDate) },
  { header: "Moved Out Date", value: (r) => date(r.movedOutDate) },
  { header: "Actual moved Out date", value: (r) => date(r.actualMovedOutDate) },
  { header: "Rent", value: (r) => r.rent },
  { header: "Advance liscene fee", value: (r) => r.advanceLicenceFee },
  ...CHECKLIST.map((c) => ({ header: c.label, value: (r) => r[c.key] })),
  { header: "Keys Location", value: (r) => r.keysLocation },
  { header: "Inspection", value: (r) => INSPECTION_LABEL[r.inspection] || r.inspection },
];


export default function AdminCheckOut() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [byDepositStatus, setByDepositStatus] = useState({});
  const [properties, setProperties] = useState([]);
  const [openCheckIns, setOpenCheckIns] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [viewing, setViewing] = useState(null);

  const [f, setF] = useState({
    year: "",
    month: "",
    propertyId: "",
    depositStatus: "",
    inspection: "",
    search: "",
  });

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
      const res = await api.get("/check-outs", { params });
      setRows(res.data.data || []);
      setTotals(res.data.totals || {});
      setByDepositStatus(res.data.byDepositStatus || {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load check-outs.");
    } finally {
      setLoading(false);
    }
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  // The occupant picker has to be refreshed after every save, since a check-out
  // removes somebody from it.
  const loadPickers = useCallback(async () => {
    try {
      const [props, open] = await Promise.all([
        api.get("/properties", { params: { limit: 200 } }),
        api.get("/check-outs/open-check-ins"),
      ]);
      setProperties(props.data.data || []);
      setOpenCheckIns(open.data.data || []);
    } catch {
      // A failed picker load leaves the form usable with typed details, so it
      // is not worth an error banner over the list.
    }
  }, []);

  useEffect(() => {
    loadPickers();
  }, [loadPickers]);

  const save = async (form) => {
    if (modal?._id) {
      const res = await api.put(`/check-outs/${modal._id}`, form);
      const updated = res.data.data;
      setRows((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } else {
      await api.post("/check-outs", form);
      await load();
    }
    await loadPickers();
    setModal(null);
  };

  const remove = async (row) => {
    if (!confirm(`Delete the check-out for ${row.tenant}? They go back to being the room's occupant.`)) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/check-outs/${row._id}`);
      await loadPickers();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Failed to delete the check-out.");
    }
  };

  const csv = () => exportCsv("check-out-entries.csv", COLUMNS, rows);
  const downloadRow = (row) => exportRowCsv("check-out", row.tenant, COLUMNS, row);

  const YES_NO = { YES: "Yes", NO: "No" };

  const detailSections = (r) => [
    {
      title: "Tenant",
      rows: [
        { label: "Name", value: r.tenant },
        { label: "Property", value: r.property },
        { label: "Room", value: r.room },
      ],
    },
    {
      title: "Contract",
      rows: [
        {
          label: "Outcome",
          value: CONTRACT_STATUS_LABEL[r.contractStatus],
          tone: CONTRACT_STATUS_TONE[r.contractStatus],
        },
        { label: "Note", value: r.contractNote },
        { label: "Rent due", value: r.rentDueDay ? ordinal(r.rentDueDay) : "" },
        { label: "Notice given", value: date(r.noticeDate) },
        { label: "Moved out (due)", value: date(r.movedOutDate) },
        { label: "Moved out (actual)", value: date(r.actualMovedOutDate) },
      ],
    },
    {
      title: "Deposit",
      rows: [
        {
          label: "Status",
          value: DEPOSIT_STATUS_LABEL[r.depositStatus],
          tone: DEPOSIT_STATUS_TONE[r.depositStatus],
        },
        { label: "Licence fee held", value: r.advanceLicenceFee ? money(r.advanceLicenceFee) : "" },
        { label: "Returned", value: r.depositReturned ? money(r.depositReturned) : "" },
        { label: "Deducted", value: r.depositDeducted ? money(r.depositDeducted) : "" },
        { label: "Note", value: r.depositNote },
        { label: "Rent", value: r.rent ? money(r.rent) : "" },
      ],
    },
    {
      title: "Move-out checklist",
      rows: [
        ...CHECKLIST.map((c) => ({ label: c.label, value: YES_NO[r[c.key]] })),
        { label: "Keys", value: r.keysLocation },
        {
          label: "Inspection",
          value: INSPECTION_LABEL[r.inspection],
          tone: INSPECTION_TONE[r.inspection],
        },
      ],
    },
    { title: "Notes", rows: [{ label: "Notes", value: r.notes }] },
  ];

  const years = useMemo(() => yearOptions(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Check-out"
        subtitle="Move-outs, the room condition checklist and how each deposit was settled"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={csv}
              disabled={!rows.length}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 disabled:opacity-50 text-[#0F253B] font-bold text-sm rounded-xl"
            >
              <Download size={16} /> Export
            </button>
            <button
              onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> New Check-out
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={LogOut} label="Check-outs" value={rows.length} sub="matching these filters" />
        <StatCard icon={KeyRound} label="Deposits held" value={money(totals.advanceLicenceFee)} sub="advance licence fees" />
        <StatCard icon={ClipboardCheck} label="Returned" value={money(totals.depositReturned)} tone="navy" />
        <StatCard icon={ClipboardCheck} label="Deducted" value={money(totals.depositDeducted)} />
      </div>

      {/* Deposit status chips — click one to filter */}
      <div className="flex flex-wrap gap-2">
        {DEPOSIT_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setF((prev) => ({ ...prev, depositStatus: prev.depositStatus === s ? "" : s }))}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
              f.depositStatus === s
                ? "bg-[#0F253B] text-white border-[#0F253B]"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            {DEPOSIT_STATUS_LABEL[s]}
            <span className="ml-2 text-[11px] opacity-60">{byDepositStatus[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={f.search}
            onChange={set("search")}
            placeholder="Search tenant, property, room or deposit note…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <select value={f.year} onChange={set("year")} className={CONTROL}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={f.month} onChange={set("month")} className={CONTROL} disabled={!f.year}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>

        <select value={f.propertyId} onChange={set("propertyId")} className={CONTROL}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>

        <select value={f.inspection} onChange={set("inspection")} className={CONTROL}>
          <option value="">Any inspection</option>
          {INSPECTION_STATUSES.map((s) => (
            <option key={s} value={s}>{INSPECTION_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Property &amp; Room</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Contract</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Notice</th>
                <th className="px-5 py-3">Moved out</th>
                <th className="px-5 py-3 text-right">Rent</th>
                <th className="px-5 py-3 text-right">Licence fee</th>
                <th className="px-5 py-3">Deposit</th>
                <th className="px-5 py-3">Checklist</th>
                <th className="px-5 py-3">Keys</th>
                <th className="px-5 py-3">Inspection</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="px-5 py-10 text-center text-gray-400">Loading check-outs…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={13} className="px-5 py-10 text-center text-gray-400">No check-outs match these filters</td></tr>
              ) : (
                rows.map((r) => {
                  const score = checklistScore(r);
                  // Expected versus actual: an early departure is the thing an
                  // operator scanning this column is looking for.
                  const early =
                    r.actualMovedOutDate &&
                    r.movedOutDate &&
                    new Date(r.actualMovedOutDate) < new Date(r.movedOutDate);

                  return (
                    <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <p className="font-bold text-[#0F253B]">{r.property}</p>
                        <p className="text-[11px] text-gray-400">{r.room || "—"}</p>
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#0F253B]">{r.tenant}</td>
                      <td className="px-5 py-3">
                        <Badge tone={CONTRACT_STATUS_TONE[r.contractStatus]}>
                          {CONTRACT_STATUS_LABEL[r.contractStatus]}
                        </Badge>
                        {r.contractNote && (
                          <p className="text-[11px] text-gray-400 mt-1 max-w-[180px] truncate" title={r.contractNote}>
                            {r.contractNote}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{ordinal(r.rentDueDay)}</td>
                      <td className="px-5 py-3 text-gray-500">{date(r.noticeDate)}</td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-[#0F253B]">{date(r.actualMovedOutDate || r.movedOutDate)}</p>
                        {early && (
                          <p className="text-[11px] text-amber-600 font-bold">early — due {date(r.movedOutDate)}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(r.rent)}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{money(r.advanceLicenceFee)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={DEPOSIT_STATUS_TONE[r.depositStatus]}>
                          {DEPOSIT_STATUS_LABEL[r.depositStatus]}
                        </Badge>
                        {r.depositNote && (
                          <p className="text-[11px] text-gray-400 mt-1 max-w-[200px] truncate" title={r.depositNote}>
                            {r.depositNote}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-[11px] font-bold ${
                            score.done === score.total ? "text-emerald-600" : "text-gray-400"
                          }`}
                        >
                          {score.done}/{score.total}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{r.keysLocation || "—"}</td>
                      <td className="px-5 py-3">
                        <Badge tone={INSPECTION_TONE[r.inspection]}>{INSPECTION_LABEL[r.inspection]}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <RowActions
                          onView={() => setViewing(r)}
                          onDownload={() => downloadRow(r)}
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
        <RecordDetail
          title={viewing.tenant}
          subtitle={`${viewing.property}${viewing.room ? ` · ${viewing.room}` : ""} · moved out ${date(
            viewing.actualMovedOutDate || viewing.movedOutDate
          )}`}
          sections={detailSections(viewing)}
          onClose={() => setViewing(null)}
          footer={
            <>
              <button
                onClick={() => downloadRow(viewing)}
                className="px-4 py-2.5 rounded-xl border border-gray-100 font-bold text-sm text-[#0F253B] hover:bg-gray-50"
              >
                Download
              </button>
              <button
                onClick={() => {
                  const row = viewing;
                  setViewing(null);
                  setModal(row);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm"
              >
                Edit
              </button>
            </>
          }
        />
      )}

      {modal !== null && (
        <CheckOutFormModal
          initial={modal}
          properties={properties}
          openCheckIns={openCheckIns}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
