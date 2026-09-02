"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Search, Download, Users, Building2, Banknote, CalendarClock, ShieldAlert,
} from "lucide-react";
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
  ROOM_STATUS_LABEL,
  ROOM_STATUS_TONE,
  exportCsv,
  exportRowCsv,
} from "../../utils/registers";

const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

// The sheet's columns, defined once so the full export and a single-row
// download can never describe a client differently.
const COLUMNS = [
  { header: "Sr. No", value: (r) => r.serial },
  { header: "Property Name", value: (r) => r.property },
  { header: "No of Rooms", value: (r) => r.roomCount },
  { header: "Room Status", value: (r) => ROOM_STATUS_LABEL[r.roomStatus] || r.roomStatus || "" },
  { header: "Tenants' Names", value: (r) => r.tenant },
  { header: "Gender & Nationality", value: (r) => r.genderNationality },
  { header: "Room Type", value: (r) => r.roomType },
  { header: "Contact #", value: (r) => r.phone },
  { header: "Start Date", value: (r) => date(r.contractStart) },
  { header: "End Date", value: (r) => date(r.contractEnd) },
  { header: "Total Duration", value: (r) => duration(r.duration) },
  { header: "Rent of Room £", value: (r) => r.rent },
  { header: "Deposit of Room £", value: (r) => r.deposit },
  { header: "Payment Due Date", value: (r) => (r.paymentDueDay ? ordinal(r.paymentDueDay) : "") },
  { header: "Name of the Bank Where Rent is to be Paid", value: (r) => r.bank },
  { header: "Agent's Name", value: (r) => r.agent },
  { header: "Email", value: (r) => r.email },
];

// `basePath` lets the manager portal render this same screen under its own
// routes, the way PropertiesBoard already works. Next passes page props here,
// none of which is basePath, so a real page render falls back to /admin.
export default function AdminClientDatabase({ basePath = "/admin" }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [properties, setProperties] = useState([]);
  const [agents, setAgents] = useState([]);
  const [banks, setBanks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The row being viewed, and the check-in being edited. `editing` holds the
  // full check-in record rather than the flattened database row, because that
  // is what the form edits.
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState("");

  const [f, setF] = useState({
    propertyId: "",
    status: "ACTIVE",
    agent: "",
    bank: "",
    expiring: "",
    search: "",
  });

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // status is sent even when empty: "" means "everyone, past clients too",
      // which is different from omitting it (the live list).
      const params = Object.fromEntries(
        Object.entries(f).filter(([k, v]) => v !== "" || k === "status")
      );
      const res = await api.get("/client-database", { params });
      setRows(res.data.data || []);
      setSummary(res.data.summary || {});
      setProperties(res.data.properties || []);
      setAgents(res.data.agents || []);
      setBanks(res.data.banks || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the client database.");
    } finally {
      setLoading(false);
    }
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  // -------------------------------------------------------------------------
  // CRUD. Every row on this screen IS a check-in, so the writes go to that
  // record — this list is a view over it, not a second copy of it.
  // -------------------------------------------------------------------------

  // The row carries only the columns the sheet shows, so editing fetches the
  // whole check-in first rather than opening a form over a partial record.
  const openEdit = async (row) => {
    setBusyId(row._id);
    setError("");
    try {
      const res = await api.get(`/check-ins/${row.checkInId}`);
      setEditing(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to open that client.");
    } finally {
      setBusyId("");
    }
  };

  const save = async (form) => {
    if (editing?._id) await api.put(`/check-ins/${editing._id}`, form);
    else await api.post("/check-ins", form);
    setEditing(null);
    await load();
  };

  const remove = async (row) => {
    const ok = confirm(
      `Delete ${row.tenant} from the client database?\n\n` +
        "This deletes their check-in record, so they also leave the room status " +
        "list and the deposit register."
    );
    if (!ok) return;

    setBusyId(row._id);
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/check-ins/${row.checkInId}`);
      await load();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Failed to delete that client.");
    } finally {
      setBusyId("");
    }
  };

  const csv = () => exportCsv("client-database.csv", COLUMNS, rows);
  const downloadRow = (row) => exportRowCsv("client", row.tenant, COLUMNS, row);

  const detailSections = (r) => [
    {
      title: "Client",
      rows: [
        { label: "Name", value: r.tenant },
        { label: "Gender & nationality", value: r.genderNationality },
        { label: "Contact", value: r.phone },
        { label: "Email", value: r.email },
        {
          label: "Status",
          value: r.status === "CHECKED_OUT" ? "Past client" : "Current client",
          tone: r.status === "CHECKED_OUT" ? "gray" : "green",
        },
      ],
    },
    {
      title: "Room",
      rows: [
        { label: "Property", value: r.property },
        { label: "Postcode", value: r.postcode },
        { label: "Room", value: r.room },
        { label: "Room type", value: r.roomType },
        {
          label: "Room status",
          value: ROOM_STATUS_LABEL[r.roomStatus] || r.roomStatus,
          tone: ROOM_STATUS_TONE[r.roomStatus],
        },
        { label: "Rooms on property", value: r.roomCount || "" },
      ],
    },
    {
      title: "Contract",
      rows: [
        { label: "Checked in", value: date(r.checkInDate) },
        { label: "Start", value: date(r.contractStart) },
        { label: "End", value: date(r.contractEnd) },
        { label: "Duration", value: duration(r.duration) },
        {
          label: "Expiry",
          value: r.expired ? "Expired" : r.expiringSoon ? "Ending soon" : "",
          tone: r.expired ? "red" : "amber",
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
    {
      title: "References",
      rows: [
        {
          label: "On file",
          value: r.hasReferences ? "Yes" : "Not collected",
          tone: r.hasReferences ? "green" : "amber",
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Client Database"
        subtitle="The master client list — every occupant, their room, contract, rent and agent"
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
              onClick={() => setEditing({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> New Client
            </button>
          </div>
        }
      />

      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-xs font-medium text-gray-500">
        Every client here is a{" "}
        <Link href={`${basePath}/check-in`} className="font-bold text-[#F47C3C] hover:underline">check-in</Link>{" "}
        record, so editing or deleting a row changes that record — and the change shows on the{" "}
        <Link href={`${basePath}/room-status`} className="font-bold text-[#F47C3C] hover:underline">room status list</Link>{" "}
        and the{" "}
        <Link href={`${basePath}/deposit-register`} className="font-bold text-[#F47C3C] hover:underline">deposit register</Link>{" "}
        too. Room counts and room status come from the room records.
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Clients" value={summary.clients ?? 0} />
        <StatCard icon={Building2} label="Properties" value={summary.properties ?? 0} />
        <StatCard icon={Banknote} label="Rent roll" value={money(summary.rent)} tone="navy" sub="per month" />
        <StatCard icon={Banknote} label="Deposits" value={money(summary.deposit)} sub="held against these clients" />
      </div>

      {/* The two things this sheet gets scanned for */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setF((prev) => ({ ...prev, expiring: prev.expiring ? "" : "true" }))}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
            f.expiring
              ? "bg-[#0F253B] text-white border-[#0F253B]"
              : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
          }`}
        >
          <CalendarClock size={15} />
          Contract ending
          <span className="text-[11px] opacity-60">
            {(summary.expiringSoon ?? 0) + (summary.expired ?? 0)}
          </span>
        </button>

        {summary.missingReferences > 0 && (
          <Link
            href={`${basePath}/reference-data`}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all"
          >
            <ShieldAlert size={15} />
            {summary.missingReferences} without references
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={f.search}
            onChange={set("search")}
            placeholder="Search client, property, room, email, phone or nationality…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

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
          <option value="ACTIVE">Current clients</option>
          <option value="CHECKED_OUT">Past clients</option>
          <option value="">Everyone</option>
        </select>
      </div>

      {/* The sheet itself */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Sr.</th>
                <th className="px-5 py-3">Property</th>
                <th className="px-5 py-3 text-center">Rooms</th>
                <th className="px-5 py-3">Room status</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Gender &amp; Nationality</th>
                <th className="px-5 py-3">Room type</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Period of contract</th>
                <th className="px-5 py-3 text-right">Rent</th>
                <th className="px-5 py-3 text-right">Deposit</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Bank</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} className="px-5 py-10 text-center text-gray-400">Loading the client database…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} className="px-5 py-10 text-center text-gray-400">No clients match these filters</td></tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r._id}
                    className={`hover:bg-gray-50/50 ${
                      // A rule above each property's first row reproduces the
                      // sheet's blocks, where one property owns a run of rows.
                      r.firstOfProperty ? "border-t-2 border-gray-100" : "border-b border-gray-50"
                    }`}
                  >
                    {/* Sr. No and the property name are written once per
                        property, exactly as the spreadsheet has them. */}
                    <td className="px-5 py-3 text-gray-400 font-bold">
                      {r.firstOfProperty ? r.serial : ""}
                    </td>
                    <td className="px-5 py-3">
                      {r.firstOfProperty && (
                        r.propertyId ? (
                          <Link
                            href={`${basePath}/properties/${r.propertyId}`}
                            className="font-bold text-[#0F253B] hover:text-[#F47C3C] transition"
                          >
                            {r.property}
                          </Link>
                        ) : (
                          <span className="font-bold text-[#0F253B]">{r.property}</span>
                        )
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-500">
                      {r.firstOfProperty ? r.roomCount || "—" : ""}
                    </td>
                    <td className="px-5 py-3">
                      {r.roomStatus ? (
                        <Badge tone={ROOM_STATUS_TONE[r.roomStatus] || "gray"}>
                          {ROOM_STATUS_LABEL[r.roomStatus] || r.roomStatus}
                        </Badge>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#0F253B] flex items-center gap-2">
                        {r.tenant}
                        {r.status === "CHECKED_OUT" && <Badge tone="gray">past</Badge>}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {r.room || "—"}{r.email ? ` · ${r.email}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{r.genderNationality || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{r.roomType || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{r.phone || "—"}</td>
                    <td className="px-5 py-3">
                      {r.contractStart || r.contractEnd ? (
                        <>
                          <p className="text-[11px] text-[#0F253B] font-semibold">
                            {date(r.contractStart)} → {date(r.contractEnd)}
                          </p>
                          <p className="text-[11px] text-gray-300">{duration(r.duration)}</p>
                          {r.expired ? (
                            <p className="text-[11px] font-bold text-red-600">expired</p>
                          ) : r.expiringSoon ? (
                            <p className="text-[11px] font-bold text-amber-600">ending soon</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(r.rent)}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{money(r.deposit)}</td>
                    <td className="px-5 py-3 text-gray-500">{ordinal(r.paymentDueDay)}</td>
                    <td className="px-5 py-3 text-gray-500">{r.bank || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{r.agent || "—"}</td>
                    <td className="px-5 py-3">
                      <RowActions
                        busy={busyId === r._id}
                        onView={() => setViewing(r)}
                        onDownload={() => downloadRow(r)}
                        onEdit={() => openEdit(r)}
                        onDelete={() => remove(r)}
                        editTitle="Edit this client's check-in"
                        deleteTitle="Delete this client's check-in"
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
          subtitle={`${viewing.property}${viewing.room ? ` · ${viewing.room}` : ""}`}
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
                  openEdit(row);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm"
              >
                Edit
              </button>
            </>
          }
        />
      )}

      {editing !== null && (
        <CheckInFormModal
          initial={editing}
          properties={properties}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
