"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Download, PiggyBank, ArrowDownLeft, ArrowUpRight, Scissors } from "lucide-react";
import { PageHeader, StatCard, Badge } from "../../Shared/ui";
import api from "../../api/api";
import CheckInFormModal from "../_components/CheckInFormModal";
import CheckOutFormModal from "../_components/CheckOutFormModal";
import RecordDetail from "../_components/RecordDetail";
import RowActions from "../_components/RowActions";
import {
  money,
  date,
  REGISTER_STATUSES,
  DEPOSIT_STATUS_LABEL,
  DEPOSIT_STATUS_TONE,
  exportCsv,
  exportRowCsv,
} from "../../utils/registers";

const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

// The register's columns, defined once so the full export and a single-row
// download can never describe a deposit differently.
const COLUMNS = [
  { header: "Tenant", value: (r) => r.tenant },
  { header: "Property", value: (r) => r.property },
  { header: "Room", value: (r) => r.room },
  { header: "Deposit Taken", value: (r) => r.taken },
  { header: "Taken On", value: (r) => date(r.takenOn) },
  { header: "Bank", value: (r) => r.bank },
  { header: "Agent", value: (r) => r.agent },
  { header: "Status", value: (r) => DEPOSIT_STATUS_LABEL[r.status] || r.status },
  { header: "Settled On", value: (r) => date(r.settledOn) },
  { header: "Returned", value: (r) => r.returned },
  { header: "Deducted", value: (r) => r.deducted },
  { header: "Outstanding", value: (r) => r.outstanding },
  { header: "Note", value: (r) => r.note },
];

// `basePath` lets the manager portal render this same screen under its own
// routes, the way PropertiesBoard already works. Next passes page props here,
// none of which is basePath, so a real page render falls back to /admin.
export default function AdminDepositRegister({ basePath = "/admin" }) {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [byStatus, setByStatus] = useState({});
  const [properties, setProperties] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // A row can open either form, depending on which record owns its figures.
  const [viewing, setViewing] = useState(null);
  const [editingIn, setEditingIn] = useState(null);
  const [editingOut, setEditingOut] = useState(null);
  const [openCheckIns, setOpenCheckIns] = useState([]);
  const [busyId, setBusyId] = useState("");

  const [f, setF] = useState({ propertyId: "", status: "", bank: "", agent: "", search: "" });

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
      const res = await api.get("/deposit-register", { params });
      setRows(res.data.data || []);
      setTotals(res.data.totals || {});
      setByStatus(res.data.byStatus || {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the deposit register.");
    } finally {
      setLoading(false);
    }
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Current occupants, for the check-out form's picker. Refreshed after a
  // settle or a delete, since both change who is still in a room.
  const loadOpenCheckIns = useCallback(async () => {
    try {
      const res = await api.get("/check-outs/open-check-ins");
      setOpenCheckIns(res.data.data || []);
    } catch {
      setOpenCheckIns([]);
    }
  }, []);

  useEffect(() => {
    loadOpenCheckIns();
  }, [loadOpenCheckIns]);

  const csv = () => exportCsv("deposit-register.csv", COLUMNS, rows);
  const downloadRow = (row) => exportRowCsv("deposit", row.tenant, COLUMNS, row);

  // -------------------------------------------------------------------------
  // CRUD. A deposit is not a record of its own — it is the span between a
  // check-in (money in) and a check-out (money out). So every write here opens
  // whichever of those two owns the figure being changed, and the confirm text
  // says which, because "delete this deposit" would otherwise be a guess.
  // -------------------------------------------------------------------------

  /** Fetch the underlying record and open the right form over it. */
  const openEdit = async (row) => {
    setBusyId(row._id);
    setError("");
    try {
      if (row.checkOutId) {
        // Settled: the returned/deducted figures live on the check-out.
        const res = await api.get(`/check-outs/${row.checkOutId}`);
        setEditingOut(res.data.data);
      } else {
        // Still held: the deposit taken lives on the check-in.
        const res = await api.get(`/check-ins/${row.checkInId}`);
        setEditingIn(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to open that record.");
    } finally {
      setBusyId("");
    }
  };

  /** Settle a held deposit: a new check-out, prefilled from its check-in. */
  const settle = (row) => {
    setViewing(null);
    setEditingOut({ checkInId: row.checkInId });
  };

  const saveCheckIn = async (form) => {
    await api.put(`/check-ins/${editingIn._id}`, form);
    setEditingIn(null);
    await load();
  };

  const saveCheckOut = async (form) => {
    if (editingOut?._id) await api.put(`/check-outs/${editingOut._id}`, form);
    else await api.post("/check-outs", form);
    setEditingOut(null);
    await Promise.all([load(), loadOpenCheckIns()]);
  };

  const remove = async (row) => {
    const settled = Boolean(row.checkOutId);
    const ok = confirm(
      settled
        ? `Delete the check-out that settled ${row.tenant}'s deposit?\n\n` +
            "The deposit goes back to being held and they become the room's current occupant again. " +
            "Their check-in is not deleted."
        : `Delete ${row.tenant}'s check-in?\n\n` +
            "This removes the deposit from the register, and removes them from the " +
            "client database and the room status list too."
    );
    if (!ok) return;

    setBusyId(row._id);
    try {
      if (settled) await api.delete(`/check-outs/${row.checkOutId}`);
      else await api.delete(`/check-ins/${row.checkInId}`);
      await Promise.all([load(), loadOpenCheckIns()]);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete that record.");
    } finally {
      setBusyId("");
    }
  };

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
      title: "Money in",
      rows: [
        { label: "Deposit taken", value: r.taken ? money(r.taken) : "" },
        { label: "Taken on", value: date(r.takenOn) },
        { label: "Bank", value: r.bank },
        { label: "Agent", value: r.agent },
        { label: "Rent", value: r.rent ? money(r.rent) : "" },
      ],
    },
    {
      title: "Money out",
      rows: [
        {
          label: "Status",
          value: DEPOSIT_STATUS_LABEL[r.status] || r.status,
          tone: DEPOSIT_STATUS_TONE[r.status],
        },
        { label: "Settled on", value: date(r.settledOn) },
        { label: "Returned", value: r.returned ? money(r.returned) : "" },
        { label: "Deducted", value: r.deducted ? money(r.deducted) : "" },
        { label: "Outstanding", value: r.outstanding ? money(r.outstanding) : "" },
        { label: "Note", value: r.note },
      ],
    },
    {
      title: "Where this comes from",
      rows: [
        {
          label: "Source",
          value:
            r.source === "CHECK_OUT"
              ? "A check-out with no check-in behind it"
              : "A check-in" + (r.checkOutId ? ", settled by a check-out" : ", not yet settled"),
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposit"
        subtitle="Every deposit taken at check-in, and how it was settled at check-out"
        action={
          <button
            onClick={csv}
            disabled={!rows.length}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 disabled:opacity-50 text-[#0F253B] font-bold text-sm rounded-xl"
          >
            <Download size={16} /> Export
          </button>
        }
      />

      {/* This register is a view over the two records that own the figures, so
          it is deliberately read-only — the edit lives where the money does. */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-xs font-medium text-gray-500">
        Read-only. A deposit taken is edited on the{" "}
        <Link href={`${basePath}/check-in`} className="font-bold text-[#F47C3C] hover:underline">check-in</Link>{" "}
        record; a deposit settled is edited on the{" "}
        <Link href={`${basePath}/check-out`} className="font-bold text-[#F47C3C] hover:underline">check-out</Link>{" "}
        record.
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={PiggyBank}
          label="Currently held"
          value={money(totals.held)}
          sub="deposits not yet settled"
          tone="navy"
        />
        <StatCard icon={ArrowDownLeft} label="Taken" value={money(totals.taken)} sub={`${rows.length} deposits`} />
        <StatCard icon={ArrowUpRight} label="Returned" value={money(totals.returned)} />
        <StatCard icon={Scissors} label="Deducted" value={money(totals.deducted)} />
      </div>

      {/* Status chips — click one to filter */}
      <div className="flex flex-wrap gap-2">
        {REGISTER_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setF((prev) => ({ ...prev, status: prev.status === s ? "" : s }))}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
              f.status === s
                ? "bg-[#0F253B] text-white border-[#0F253B]"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            {DEPOSIT_STATUS_LABEL[s]}
            <span className="ml-2 text-[11px] opacity-60">{byStatus[s] ?? 0}</span>
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
            placeholder="Search tenant, property, bank, agent or note…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <select value={f.propertyId} onChange={set("propertyId")} className={CONTROL}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Property &amp; Room</th>
                <th className="px-5 py-3 text-right">Taken</th>
                <th className="px-5 py-3">Taken on</th>
                <th className="px-5 py-3">Bank / Agent</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Settled</th>
                <th className="px-5 py-3 text-right">Returned</th>
                <th className="px-5 py-3 text-right">Deducted</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-5 py-10 text-center text-gray-400">Loading deposits…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-10 text-center text-gray-400">No deposits match these filters</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-bold text-[#0F253B]">{r.tenant}</p>
                      {r.note && (
                        <p className="text-[11px] text-gray-400 max-w-[220px] truncate" title={r.note}>{r.note}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#0F253B]">{r.property}</p>
                      <p className="text-[11px] text-gray-400">{r.room || "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(r.taken)}</td>
                    <td className="px-5 py-3 text-gray-500">{date(r.takenOn)}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {r.bank || "—"}
                      {r.agent && <span className="text-[11px] text-gray-300"> · {r.agent}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={DEPOSIT_STATUS_TONE[r.status]}>
                        {DEPOSIT_STATUS_LABEL[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{date(r.settledOn)}</td>
                    <td className="px-5 py-3 text-right text-emerald-600 font-semibold">
                      {r.returned ? money(r.returned) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-red-600 font-semibold">
                      {r.deducted ? money(r.deducted) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#0F253B]">
                      {r.outstanding ? money(r.outstanding) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <RowActions
                        busy={busyId === r._id}
                        onView={() => setViewing(r)}
                        onDownload={() => downloadRow(r)}
                        onEdit={() => openEdit(r)}
                        onDelete={() => remove(r)}
                        // A deposit is not its own record, so the tooltips say
                        // which record the action actually touches.
                        editTitle={
                          r.checkOutId
                            ? "Edit the check-out that settled this deposit"
                            : "Edit the check-in that took this deposit"
                        }
                        deleteTitle={
                          r.checkOutId
                            ? "Delete the check-out — the deposit goes back to held"
                            : "Delete the check-in that took this deposit"
                        }
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
              {/* A held deposit has no settlement yet, so the useful next step
                  is to create one rather than to edit what is not there. */}
              {viewing.status === "HELD" && viewing.checkInId && (
                <button
                  onClick={() => settle(viewing)}
                  className="px-4 py-2.5 rounded-xl border border-gray-100 font-bold text-sm text-[#0F253B] hover:bg-gray-50"
                >
                  Settle deposit
                </button>
              )}
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

      {editingIn !== null && (
        <CheckInFormModal
          initial={editingIn}
          properties={properties}
          onClose={() => setEditingIn(null)}
          onSave={saveCheckIn}
        />
      )}

      {editingOut !== null && (
        <CheckOutFormModal
          initial={editingOut}
          properties={properties}
          openCheckIns={openCheckIns}
          onClose={() => setEditingOut(null)}
          onSave={saveCheckOut}
        />
      )}
    </div>
  );
}
