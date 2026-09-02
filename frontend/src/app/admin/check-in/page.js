"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Download, LogIn, Wallet, Users } from "lucide-react";
import { PageHeader, StatCard, Badge } from "../../Shared/ui";
import api from "../../api/api";
import CheckInFormModal from "../_components/CheckInFormModal";
import RecordDetail from "../_components/RecordDetail";
import RowActions from "../_components/RowActions";
import {
  money,
  date,
  ordinal,
  duration,
  MONTHS,
  yearOptions,
  exportCsv,
  exportRowCsv,
} from "../../utils/registers";

const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

const GENDER_LABEL = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

// The register's columns, defined once so the full export and a single-row
// download can never describe a check-in differently.
const COLUMNS = [
  { header: "Property", value: (r) => r.property },
  { header: "Room", value: (r) => r.room },
  { header: "Client Name", value: (r) => r.tenant },
  { header: "Email", value: (r) => r.email },
  { header: "Contact", value: (r) => r.phone },
  { header: "Gender", value: (r) => r.gender },
  { header: "Nationality", value: (r) => r.nationality },
  { header: "Room Type", value: (r) => r.roomType },
  { header: "Rent", value: (r) => r.rent },
  { header: "Deposit", value: (r) => r.deposit },
  { header: "Rent Due Day", value: (r) => r.paymentDueDay ?? "" },
  { header: "Room rented date", value: (r) => date(r.roomRentedDate) },
  { header: "Check-in date", value: (r) => date(r.checkInDate) },
  { header: "Contract Start", value: (r) => date(r.contractStart) },
  { header: "Contract End", value: (r) => date(r.contractEnd) },
  { header: "Agent", value: (r) => r.agent },
  { header: "Bank", value: (r) => r.bank },
  { header: "Status", value: (r) => r.status },
];

/**
 * Years/months/days between the contract dates, for the detail view. The
 * backend computes the same thing for the room status list and the client
 * database; this is the one screen that has the dates but not the derived
 * figure, so it is worked out here rather than widening the list response.
 */
const contractSpan = (r) => {
  if (!r.contractStart || !r.contractEnd) return null;
  const from = new Date(r.contractStart);
  const to = new Date(r.contractEnd);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;

  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
};


export default function AdminCheckIn() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ rent: 0, deposit: 0 });
  const [agents, setAgents] = useState([]);
  const [banks, setBanks] = useState([]);
  const [properties, setProperties] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [viewing, setViewing] = useState(null);

  const [f, setF] = useState({
    year: "",
    month: "",
    propertyId: "",
    agent: "",
    bank: "",
    status: "ACTIVE",
    search: "",
  });

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
      const res = await api.get("/check-ins", { params });
      setRows(res.data.data || []);
      setTotals(res.data.totals || { rent: 0, deposit: 0 });
      setAgents(res.data.agents || []);
      setBanks(res.data.banks || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load check-ins.");
    } finally {
      setLoading(false);
    }
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  // The property picker is for the form as much as the filter, so it is loaded
  // once rather than with every filter change.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/properties", { params: { limit: 200 } });
        setProperties(res.data.data || []);
      } catch {
        setProperties([]);
      }
    })();
  }, []);

  const save = async (form) => {
    if (modal?._id) {
      const res = await api.put(`/check-ins/${modal._id}`, form);
      const updated = res.data.data;
      setRows((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } else {
      await api.post("/check-ins", form);
      // Reload rather than unshift: the row's position depends on the active
      // date filter, which the new record may fall outside of entirely.
      await load();
    }
    setModal(null);
  };

  const remove = async (row) => {
    if (!confirm(`Delete the check-in for ${row.tenant}?`)) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/check-ins/${row._id}`);
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Failed to delete the check-in.");
    }
  };

  const csv = () => exportCsv("check-in-entries.csv", COLUMNS, rows);
  const downloadRow = (row) => exportRowCsv("check-in", row.tenant, COLUMNS, row);

  const detailSections = (r) => [
    {
      title: "Client",
      rows: [
        { label: "Name", value: r.tenant },
        { label: "Email", value: r.email },
        { label: "Contact", value: r.phone },
        { label: "Gender", value: GENDER_LABEL[r.gender] },
        { label: "Nationality", value: r.nationality },
        {
          label: "Status",
          value: r.status === "CHECKED_OUT" ? "Checked out" : "Still in",
          tone: r.status === "CHECKED_OUT" ? "gray" : "green",
        },
      ],
    },
    {
      title: "Room",
      rows: [
        { label: "Property", value: r.property },
        { label: "Room", value: r.room },
        { label: "Room type", value: r.roomType },
      ],
    },
    {
      title: "Dates",
      rows: [
        { label: "Room rented", value: date(r.roomRentedDate) },
        { label: "Checked in", value: date(r.checkInDate) },
        { label: "Contract start", value: date(r.contractStart) },
        { label: "Contract end", value: date(r.contractEnd) },
        {
          label: "Duration",
          value: duration(contractSpan(r)),
          hide: !r.contractStart || !r.contractEnd,
        },
      ],
    },
    {
      title: "Money",
      rows: [
        { label: "Rent", value: r.rent ? money(r.rent) : "" },
        { label: "Deposit", value: r.deposit ? money(r.deposit) : "" },
        { label: "Rent due", value: r.paymentDueDay ? ordinal(r.paymentDueDay) : "" },
        { label: "Bank", value: r.bank },
        { label: "Agent", value: r.agent },
      ],
    },
    { title: "Notes", rows: [{ label: "Notes", value: r.notes }] },
  ];

  const years = useMemo(() => yearOptions(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Check-in"
        subtitle="Every tenant moving in — rent, deposit, contract, agent and bank"
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
              <Plus size={18} /> New Check-in
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Check-ins" value={rows.length} sub="matching these filters" />
        <StatCard icon={LogIn} label="Rent" value={money(totals.rent)} sub="per month, combined" />
        <StatCard icon={Wallet} label="Deposits taken" value={money(totals.deposit)} tone="navy" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={f.search}
            onChange={set("search")}
            placeholder="Search tenant, property, room, email or phone…"
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

        <select value={f.agent} onChange={set("agent")} className={CONTROL}>
          <option value="">All agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={f.bank} onChange={set("bank")} className={CONTROL}>
          <option value="">All banks</option>
          {banks.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        <select value={f.status} onChange={set("status")} className={CONTROL}>
          <option value="ACTIVE">Still in</option>
          <option value="CHECKED_OUT">Checked out</option>
          <option value="">Everyone</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Property &amp; Room</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3 text-right">Rent</th>
                <th className="px-5 py-3 text-right">Deposit</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Room rented</th>
                <th className="px-5 py-3">Check-in</th>
                <th className="px-5 py-3">Contract</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Bank</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-5 py-10 text-center text-gray-400">Loading check-ins…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-10 text-center text-gray-400">No check-ins match these filters</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-bold text-[#0F253B]">{r.property}</p>
                      <p className="text-[11px] text-gray-400">{r.room || "—"}{r.roomType ? ` · ${r.roomType}` : ""}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#0F253B] flex items-center gap-2">
                        {r.tenant}
                        {r.status === "CHECKED_OUT" && <Badge tone="gray">out</Badge>}
                      </p>
                      <p className="text-[11px] text-gray-400">{r.email || r.phone || "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(r.rent)}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{money(r.deposit)}</td>
                    <td className="px-5 py-3 text-gray-500">{ordinal(r.paymentDueDay)}</td>
                    <td className="px-5 py-3 text-gray-500">{date(r.roomRentedDate)}</td>
                    <td className="px-5 py-3 font-semibold text-[#0F253B]">{date(r.checkInDate)}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {r.contractStart || r.contractEnd ? (
                        <span className="text-[11px]">{date(r.contractStart)} → {date(r.contractEnd)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{r.agent || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{r.bank || "—"}</td>
                    <td className="px-5 py-3">
                      <RowActions
                        onView={() => setViewing(r)}
                        onDownload={() => downloadRow(r)}
                        onEdit={() => setModal(r)}
                        onDelete={() => remove(r)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <RecordDetail
          title={viewing.tenant}
          subtitle={`${viewing.property}${viewing.room ? ` · ${viewing.room}` : ""} · checked in ${date(viewing.checkInDate)}`}
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
        <CheckInFormModal
          initial={modal}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
