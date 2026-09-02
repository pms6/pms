"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search, Download, Building2, DoorOpen, Users, Banknote, AlertTriangle, X, Check,
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
  ROOM_STATUSES,
  ROOM_STATUS_LABEL,
  ROOM_STATUS_TONE,
  exportCsv,
  exportRowCsv,
} from "../../utils/registers";

const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

// The sheet's columns, defined once so the full export and a single-row
// download can never describe a room differently. Each entry is a flattened
// { g, room, o } — property, room, occupant.
const COLUMNS = [
  { header: "Property Name", value: (r) => r.g.property },
  { header: "No of Rooms", value: (r) => r.g.roomCount },
  { header: "Room", value: (r) => r.room.room },
  { header: "Room Status", value: (r) => ROOM_STATUS_LABEL[r.room.status] || r.room.status },
  { header: "Room Type", value: (r) => r.o?.roomType || r.room.roomType || "" },
  { header: "Tenants' Names", value: (r) => r.o?.tenant || "" },
  { header: "Gender & Nationality", value: (r) => r.o?.genderNationality || "" },
  { header: "Contact #", value: (r) => r.o?.phone || "" },
  { header: "Email", value: (r) => r.o?.email || "" },
  { header: "Start Date", value: (r) => date(r.o?.contractStart) },
  { header: "End Date", value: (r) => date(r.o?.contractEnd) },
  { header: "Total Duration", value: (r) => duration(r.o?.duration) },
  { header: "Rent of Room £", value: (r) => r.o?.rent ?? r.room.monthlyRent ?? "" },
  { header: "Deposit of Room £", value: (r) => r.o?.deposit ?? r.room.securityDeposit ?? "" },
  { header: "Payment Due Date", value: (r) => (r.o?.paymentDueDay ? ordinal(r.o.paymentDueDay) : "") },
  { header: "Bank", value: (r) => r.o?.bank || "" },
  { header: "Agent's Name", value: (r) => r.o?.agent || "" },
];

/** One room, with however many occupants it holds. */
function RoomRow({ room, group, onView, onDownload, onEdit, onDelete, busy }) {
  // A room with nobody in it still needs a line, so an empty occupant list
  // renders one row of dashes rather than disappearing.
  const occupants = room.occupants.length ? room.occupants : [null];

  return occupants.map((o, i) => (
    <tr key={room.roomId + "-" + i} className="border-b border-gray-50 hover:bg-gray-50/50">
      {/* The room cell spans its occupants, so a double room reads as one room
          with two people rather than as two rooms. */}
      {i === 0 && (
        <td className="px-5 py-3 align-top" rowSpan={occupants.length}>
          <p className="font-bold text-[#0F253B]">{room.room || "—"}</p>
          <p className="text-[11px] text-gray-400">
            {o?.roomType || room.roomType || "—"}
            {room.roomNumber ? ` · ${room.roomNumber}` : ""}
          </p>
          {!room.linked && (
            <p className="text-[10px] font-bold text-amber-600 mt-1">no room record</p>
          )}
        </td>
      )}
      {i === 0 && (
        <td className="px-5 py-3 align-top" rowSpan={occupants.length}>
          <Badge tone={ROOM_STATUS_TONE[room.status]}>{ROOM_STATUS_LABEL[room.status] || room.status}</Badge>
        </td>
      )}
      <td className="px-5 py-3">
        {o ? (
          <>
            <p className="font-semibold text-[#0F253B]">{o.tenant}</p>
            <p className="text-[11px] text-gray-400">{o.email || "—"}</p>
          </>
        ) : (
          <span className="text-gray-300">Vacant</span>
        )}
      </td>
      <td className="px-5 py-3 text-gray-500">{o?.genderNationality || "—"}</td>
      <td className="px-5 py-3 text-gray-500">{o?.phone || "—"}</td>
      <td className="px-5 py-3 text-gray-500">
        {o?.contractStart || o?.contractEnd ? (
          <>
            <p className="text-[11px]">{date(o.contractStart)} → {date(o.contractEnd)}</p>
            <p className="text-[11px] text-gray-300">{duration(o.duration)}</p>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-5 py-3 text-right font-bold text-[#0F253B]">
        {o ? money(o.rent) : room.monthlyRent ? <span className="text-gray-300">{money(room.monthlyRent)}</span> : "—"}
      </td>
      <td className="px-5 py-3 text-right text-gray-500">
        {o ? money(o.deposit) : room.securityDeposit ? <span className="text-gray-300">{money(room.securityDeposit)}</span> : "—"}
      </td>
      <td className="px-5 py-3 text-gray-500">{ordinal(o?.paymentDueDay)}</td>
      <td className="px-5 py-3 text-gray-500">{o?.bank || "—"}</td>
      <td className="px-5 py-3 text-gray-500">{o?.agent || "—"}</td>

      {/* Actions belong to the room, not to each occupant, so like the room
          cell they span the room's rows. */}
      {i === 0 && (
        <td className="px-5 py-3 align-top" rowSpan={occupants.length}>
          <RowActions
            busy={busy}
            onView={() => onView(room, group)}
            onDownload={() => onDownload(room, group)}
            onEdit={() => onEdit(room)}
            onDelete={() => onDelete(room)}
            editTitle={room.linked ? "Change this room's status" : "Edit this occupant's check-in"}
            deleteTitle={room.linked ? "Delete this room record" : "Delete this occupant's check-in"}
          />
        </td>
      )}
    </tr>
  ));
}

/**
 * Setting a room's status. Deliberately narrow: this screen is the room status
 * list, and the rest of a room — pricing, amenities, photos — is edited on the
 * room page, which this links to rather than reproduces.
 */
function RoomStatusModal({ room, propertyId, basePath, onClose, onSave }) {
  const [status, setStatus] = useState(room.status || "AVAILABLE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(status);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update the room status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B]">{room.room || "Room"}</h3>
            <p className="text-xs text-gray-400 font-medium">Set what state this room is in</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {ROOM_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                  status === s
                    ? "bg-[#0F253B] text-white border-[#0F253B]"
                    : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                }`}
              >
                {ROOM_STATUS_LABEL[s]}
                {status === s && <Check size={16} />}
              </button>
            ))}
          </div>

          {propertyId && room.roomId && (
            <Link
              href={`${basePath}/properties/${propertyId}/rooms/${room.roomId}`}
              className="block text-center text-xs font-bold text-[#F47C3C] hover:underline"
            >
              Edit the rest of this room →
            </Link>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {saving ? "Saving…" : "Save status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// `basePath` lets the manager portal render this same screen under its own
// routes, the way PropertiesBoard already works. Next passes page props here,
// none of which is basePath, so a real page render falls back to /admin.
export default function AdminRoomStatus({ basePath = "/admin" }) {
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState({ byStatus: {} });
  const [properties, setProperties] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // A row can open the room's status form, or — when the row has no room
  // record — the occupant's check-in form.
  const [viewing, setViewing] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingCheckIn, setEditingCheckIn] = useState(null);
  const [busyId, setBusyId] = useState("");

  const [f, setF] = useState({ propertyId: "", status: "", search: "" });

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
      const res = await api.get("/room-status", { params });
      setGroups(res.data.data || []);
      setSummary(res.data.summary || { byStatus: {} });
      setProperties(res.data.properties || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the room status list.");
    } finally {
      setLoading(false);
    }
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  /** One line per occupant, plus a line for each vacant room. */
  const flatten = (gs) => {
    const flat = [];
    for (const g of gs) {
      for (const room of g.rooms) {
        const occupants = room.occupants.length ? room.occupants : [null];
        for (const o of occupants) {
          flat.push({ g, room, o });
        }
      }
    }
    return flat;
  };

  const downloadRow = (room, g) =>
    exportRowCsv(
      "room",
      `${g.property} ${room.room}`,
      COLUMNS,
      { g, room, o: room.occupants[0] || null }
    );

  // -------------------------------------------------------------------------
  // CRUD. A row here is a room, so a write goes to the room record — except on
  // a row with no room behind it, where the only thing that exists is the
  // occupant's check-in, so that is what gets edited or deleted instead.
  // -------------------------------------------------------------------------

  const openEdit = async (room) => {
    setError("");
    if (room.linked) {
      setEditingRoom(room);
      return;
    }

    const occupant = room.occupants[0];
    if (!occupant?.checkInId) {
      setError("There is nothing behind this row to edit.");
      return;
    }
    setBusyId(room.roomId || occupant.checkInId);
    try {
      const res = await api.get(`/check-ins/${occupant.checkInId}`);
      setEditingCheckIn(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to open that occupant.");
    } finally {
      setBusyId("");
    }
  };

  const saveRoomStatus = async (status) => {
    await api.patch(`/rooms/${editingRoom.roomId}/status`, { status });
    setEditingRoom(null);
    await load();
  };

  const saveCheckIn = async (form) => {
    await api.put(`/check-ins/${editingCheckIn._id}`, form);
    setEditingCheckIn(null);
    await load();
  };

  const remove = async (room) => {
    const occupant = room.occupants[0];

    if (!room.linked) {
      if (!occupant?.checkInId) return;
      const ok = confirm(
        `Delete ${occupant.tenant}'s check-in?\n\n` +
          "This row has no room record behind it, so the check-in is the only thing to delete. " +
          "They also leave the client database and the deposit register."
      );
      if (!ok) return;

      setBusyId(room.roomId || occupant.checkInId);
      try {
        await api.delete(`/check-ins/${occupant.checkInId}`);
        await load();
      } catch (err) {
        alert(err.response?.data?.message || "Failed to delete that occupant.");
      } finally {
        setBusyId("");
      }
      return;
    }

    const ok = confirm(
      `Delete the room "${room.room}"?\n\n` +
        "This deletes the room record itself, not the tenants' check-ins."
    );
    if (!ok) return;

    setBusyId(room.roomId);
    try {
      await api.delete(`/rooms/${room.roomId}`);
      await load();
    } catch (err) {
      // The API refuses to delete an occupied or reserved room, which is the
      // message worth showing rather than a generic failure.
      alert(err.response?.data?.message || "Failed to delete that room.");
    } finally {
      setBusyId("");
    }
  };

  const detailSections = (room, g) => {
    const o = room.occupants[0];
    return [
      {
        title: "Room",
        rows: [
          { label: "Property", value: g.property },
          { label: "Postcode", value: g.postcode },
          { label: "Room", value: room.room },
          { label: "Room number", value: room.roomNumber },
          { label: "Room type", value: o?.roomType || room.roomType },
          { label: "Occupancy", value: room.occupancy },
          {
            label: "Status",
            value: ROOM_STATUS_LABEL[room.status] || room.status,
            tone: ROOM_STATUS_TONE[room.status],
          },
          { label: "Available from", value: date(room.availableFrom) },
          {
            label: "Room record",
            value: room.linked ? "" : "None — typed off the spreadsheet",
            tone: "amber",
          },
        ],
      },
      {
        title: "Advertised",
        rows: [
          { label: "Rent", value: room.monthlyRent ? money(room.monthlyRent) : "" },
          { label: "Deposit", value: room.securityDeposit ? money(room.securityDeposit) : "" },
        ],
      },
      ...room.occupants.map((occ, i) => ({
        title: room.occupants.length > 1 ? `Occupant ${i + 1}` : "Occupant",
        rows: [
          { label: "Name", value: occ.tenant },
          { label: "Gender & nationality", value: occ.genderNationality },
          { label: "Contact", value: occ.phone },
          { label: "Email", value: occ.email },
          { label: "Checked in", value: date(occ.checkInDate) },
          { label: "Contract", value: occ.contractStart || occ.contractEnd
              ? `${date(occ.contractStart)} → ${date(occ.contractEnd)}`
              : "" },
          { label: "Duration", value: occ.duration ? duration(occ.duration) : "" },
          { label: "Rent", value: occ.rent ? money(occ.rent) : "" },
          { label: "Deposit", value: occ.deposit ? money(occ.deposit) : "" },
          { label: "Rent due", value: occ.paymentDueDay ? ordinal(occ.paymentDueDay) : "" },
          { label: "Bank", value: occ.bank },
          { label: "Agent", value: occ.agent },
        ],
      })),
    ];
  };

  const csv = () => {
    // The shape the Database sheet has, where the property name repeats down
    // its rooms.
    exportCsv("room-status-list.csv", COLUMNS, flatten(groups));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Room Status List"
        subtitle="Every property, its rooms, the state each one is in and who is in it"
        action={
          <button
            onClick={csv}
            disabled={!groups.length}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 disabled:opacity-50 text-[#0F253B] font-bold text-sm rounded-xl"
          >
            <Download size={16} /> Export
          </button>
        }
      />

      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-xs font-medium text-gray-500">
        Read-only. A room&rsquo;s status is set on the{" "}
        <Link href={`${basePath}/properties`} className="font-bold text-[#F47C3C] hover:underline">room record</Link>;
        the occupant, contract and money come from their{" "}
        <Link href={`${basePath}/check-in`} className="font-bold text-[#F47C3C] hover:underline">check-in</Link>.
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Properties" value={summary.properties ?? 0} />
        <StatCard icon={DoorOpen} label="Rooms" value={summary.rooms ?? 0} />
        <StatCard icon={Users} label="Occupants" value={summary.occupants ?? 0} />
        <StatCard icon={Banknote} label="Rent roll" value={money(summary.rentRoll)} tone="navy" sub="occupied rooms" />
      </div>

      {summary.unplaced > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          <AlertTriangle size={16} />
          {summary.unplaced} check-in{summary.unplaced === 1 ? "" : "s"} name no property record, so they are not on this
          list. Link them from the check-in register.
        </div>
      )}

      {/* Status chips — click one to filter */}
      <div className="flex flex-wrap gap-2">
        {ROOM_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setF((prev) => ({ ...prev, status: prev.status === s ? "" : s }))}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
              f.status === s
                ? "bg-[#0F253B] text-white border-[#0F253B]"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            {ROOM_STATUS_LABEL[s]}
            <span className="ml-2 text-[11px] opacity-60">{summary.byStatus?.[s] ?? 0}</span>
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
            placeholder="Search property, room, tenant, email or phone…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <select value={f.propertyId} onChange={set("propertyId")} className={CONTROL}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-10 text-center text-gray-400">
          Loading the room status list…
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-10 text-center text-gray-400">
          No rooms match these filters
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.propertyId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Property header — the sheet's "Property Name / No of Rooms" row */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <Link
                  href={`${basePath}/properties/${g.propertyId}`}
                  className="font-bold text-[#0F253B] hover:text-[#F47C3C] transition"
                >
                  {g.property}
                </Link>
                <p className="text-[11px] text-gray-400 font-medium">
                  {[g.city, g.postcode].filter(Boolean).join(" · ") || "—"}
                  {g.rentalType ? ` · ${g.rentalType.replace("_", " ")}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                <span>{g.roomCount} rooms</span>
                <span>{g.occupantCount} occupants</span>
                <span className="text-[#0F253B]">{money(g.rentRoll)}</span>
                <div className="flex gap-1">
                  {ROOM_STATUSES.filter((s) => g.counts[s]).map((s) => (
                    <Badge key={s} tone={ROOM_STATUS_TONE[s]}>
                      {g.counts[s]} {ROOM_STATUS_LABEL[s].toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3">Room</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3">Gender &amp; Nationality</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Contract</th>
                    <th className="px-5 py-3 text-right">Rent</th>
                    <th className="px-5 py-3 text-right">Deposit</th>
                    <th className="px-5 py-3">Due</th>
                    <th className="px-5 py-3">Bank</th>
                    <th className="px-5 py-3">Agent</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rooms.map((room, i) => (
                    <RoomRow
                      key={room.roomId || `${g.propertyId}-unlinked-${i}`}
                      room={room}
                      group={g}
                      busy={busyId === (room.roomId || room.occupants[0]?.checkInId)}
                      onView={(rm, grp) => setViewing({ room: rm, group: grp })}
                      onDownload={downloadRow}
                      onEdit={openEdit}
                      onDelete={remove}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {viewing && (
        <RecordDetail
          title={viewing.room.room || "Room"}
          subtitle={viewing.group.property}
          sections={detailSections(viewing.room, viewing.group)}
          onClose={() => setViewing(null)}
          footer={
            <>
              <button
                onClick={() => downloadRow(viewing.room, viewing.group)}
                className="px-4 py-2.5 rounded-xl border border-gray-100 font-bold text-sm text-[#0F253B] hover:bg-gray-50"
              >
                Download
              </button>
              <button
                onClick={() => {
                  const room = viewing.room;
                  setViewing(null);
                  openEdit(room);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm"
              >
                Edit
              </button>
            </>
          }
        />
      )}

      {editingRoom && (
        <RoomStatusModal
          room={editingRoom}
          propertyId={groups.find((g) => g.rooms.includes(editingRoom))?.propertyId}
          basePath={basePath}
          onClose={() => setEditingRoom(null)}
          onSave={saveRoomStatus}
        />
      )}

      {editingCheckIn && (
        <CheckInFormModal
          initial={editingCheckIn}
          properties={properties}
          onClose={() => setEditingCheckIn(null)}
          onSave={saveCheckIn}
        />
      )}
    </div>
  );
}
