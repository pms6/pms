"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  X,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  CalendarClock,
  RotateCcw,
  Search,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import RescheduleModal from "./RescheduleModal";
import { AddedBy, creatorOf } from "./creator";
import api from "../api/api";
import { useAuth } from "../Context/AuthContext";

// One viewings board, rendered by every staff portal (admin, manager, agent,
// finance). Scheduling, rescheduling, completing, cancelling and RE-OPENING a
// finished viewing are all team actions — a manager or agent who mis-clicked
// "Done" needs to undo it as much as the owner does, so no action here is
// gated on a role.
//
// Tenants never reach this board. They get /tenant/viewing, which talks to the
// separate /viewings/my endpoints, and the API refuses them the staff routes.

const useViewingsData = ({ status = "", person = "", propertyId = "" } = {}) => {
  const { user } = useAuth();
  const organizationId = user?.organization?._id || user?.organizationId;
  const userId = user?._id;

  const [allViewings, setAllViewings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [viewingsLoading, setViewingsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchAllViewings = useCallback(async () => {
    if (!organizationId) return;
    setViewingsLoading(true);
    try {
      const res = await api.get("/viewings");
      const data = res.data?.data || res.data || [];
      setAllViewings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch viewings:", err);
      setAllViewings([]);
    } finally {
      setViewingsLoading(false);
    }
  }, [organizationId]);

  const fetchSupportingData = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [lRes, pRes, rRes] = await Promise.all([
        api.get("/leads"),
        api.get("/properties", { params: { limit: 1000 } }),
        api.get("/rooms", { params: { limit: 1000 } }),
      ]);
      setLeads(lRes.data?.data || lRes.data || []);
      setProperties(pRes.data?.data || pRes.data || []);
      setAllRooms(rRes.data?.data || rRes.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [organizationId]);

  const createViewing = async (formData) => {
    if (!organizationId) throw new Error("Organization ID missing");

    const payload = { ...formData, organizationId, createdBy: userId };

    // A select left on its placeholder posts "". Room is optional — a property
    // with no rooms, or a whole-property viewing, has nothing to send — but an
    // empty string is not a valid ObjectId, so it has to be dropped rather than
    // sent as "".
    if (!payload.room) delete payload.room;

    const res = await api.post("/viewings", payload);
    const newViewing = res.data?.data || res.data;
    setAllViewings((prev) => [...prev, newViewing]);
    return newViewing;
  };

  const updateViewingStatus = async (id, status) => {
    try {
      const res = await api.patch(`/viewings/${id}/status`, { status });
      const updated = res.data?.data || res.data;
      setAllViewings((prev) => prev.map((v) => (v._id === id ? updated : v)));
      return updated;
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to update status");
    }
  };

  const rescheduleViewing = async (id, payload) => {
    const res = await api.patch(`/viewings/${id}/reschedule`, payload);
    const updated = res.data?.data || res.data;
    setAllViewings((prev) => prev.map((v) => (v._id === id ? updated : v)));
    return updated;
  };

  const respondToRequest = async (id, action, note = "") => {
    try {
      const res = await api.patch(`/viewings/${id}/reschedule-request/respond`, {
        action,
        note,
      });
      const updated = res.data?.data || res.data;
      setAllViewings((prev) => prev.map((v) => (v._id === id ? updated : v)));
      return updated;
    } catch (error) {
      alert(error.response?.data?.message || "Failed to respond to the request");
    }
  };

  useEffect(() => {
    if (!organizationId) return;

    (async () => {
      setInitialLoading(true);
      await fetchSupportingData();
      await fetchAllViewings();
      setInitialLoading(false);
    })();
  }, [organizationId, fetchSupportingData, fetchAllViewings]);

  // Every property that has at least one viewing, for the property filter.
  // Built from the UNfiltered list so the dropdown does not shrink as the other
  // filters narrow the board — otherwise picking a property would remove every
  // other option from the list you just used.
  const propertyOptions = useMemo(() => {
    const byId = new Map();

    allViewings.forEach((v) => {
      const id = String(v.property?._id ?? v.property ?? "");
      if (!id || byId.has(id)) return;

      byId.set(
        id,
        v.property?.name ||
          (typeof v.property === "string" ? v.property : "") ||
          "Unnamed property"
      );
    });

    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allViewings]);

  // Frontend filtering — the status chips, the person search and the property
  // picker all narrow the same list, so they combine rather than override.
  const personQuery = person.trim().toLowerCase();

  const filteredViewings = allViewings.filter((v) => {
    if (status && v.status !== status) return false;

    if (propertyId && String(v.property?._id ?? v.property ?? "") !== propertyId) {
      return false;
    }

    if (personQuery) {
      // Every person named on the card: the lead being shown round, the agent
      // showing them, and the member who scheduled it. The scheduler comes from
      // creatorOf so the search matches the name actually rendered by AddedBy
      // (the local part of the email); their full address is matched too, since
      // that is what the card's tooltip shows.
      //
      // `lead` is populated by the API but can still arrive as a bare id/string
      // on older rows, hence the fallback.
      const creator = creatorOf(v);

      const names = [
        v.lead?.name || (typeof v.lead === "string" ? v.lead : ""),
        v.agent,
        creator?.label,
        creator?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!names.includes(personQuery)) return false;
    }

    return true;
  });

  return {
    viewings: filteredViewings,
    propertyOptions,
    allViewings,
    leads,
    properties,
    allRooms,
    viewingsLoading,
    initialLoading,
    createViewing,
    updateViewingStatus,
    rescheduleViewing,
    respondToRequest,
  };
};

// ==================== UI ====================
const STATUS_TONE = { scheduled: "orange", done: "green", cancelled: "gray" };

function prettyDay(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function ViewingModal({ onClose, onCreate, leads, properties, allRooms }) {
  const [form, setForm] = useState({
    date: "", // empty on server → no hydration mismatch
    time: "10:00",
    lead: "",
    property: "",
    room: "",
    agent: "",
    status: "scheduled",
  });
  const [submitting, setSubmitting] = useState(false);

  // Set today's date only on the client
  useEffect(() => {
    setForm((prev) => ({ ...prev, date: todayISO() }));
  }, []);

  const handleChange = (k) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const newForm = { ...prev, [k]: value };
      if (k === "property") newForm.room = "";
      return newForm;
    });
  };

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls =
    "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  const availableRooms = form.property
    ? allRooms.filter((r) => {
        const pid = r.propertyId?._id ?? r.propertyId;
        return String(pid) === String(form.property);
      })
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // block extra clicks

    setSubmitting(true);
    try {
      await onCreate(form);
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to schedule viewing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">Schedule Viewing</h3>
          <button onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                className={field}
                value={form.date}
                onChange={handleChange("date")}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Time</label>
              <input
                type="time"
                className={field}
                value={form.time}
                onChange={handleChange("time")}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Lead</label>
            <select
              className={field}
              value={form.lead}
              onChange={handleChange("lead")}
              required
            >
              <option value="">Select lead…</option>
              {leads.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Property</label>
              {/* Required by the API, so the browser blocks an empty submit
                  here rather than letting the server reject it. */}
              <select
                className={field}
                value={form.property}
                onChange={handleChange("property")}
                required
              >
                <option value="">Select property…</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Room</label>
              {/* Optional: a single let has no rooms to pick, and a viewing can
                  cover the whole property. */}
              <select
                className={field}
                value={form.room}
                onChange={handleChange("room")}
                disabled={!form.property || availableRooms.length === 0}
              >
                <option value="">
                  {form.property && availableRooms.length === 0
                    ? "No rooms — whole property"
                    : "Select room…"}
                </option>
                {availableRooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.roomName || r.title}{" "}
                    {r.roomNumber ? `(${r.roomNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Agent</label>
            <input
              className={field}
              value={form.agent}
              onChange={handleChange("agent")}
              placeholder="Who is showing the property?"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {submitting ? "Scheduling…" : "Schedule Viewing"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ViewingsBoard({
  title = "Viewings",
  subtitle = "Scheduled property viewings",
}) {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [person, setPerson] = useState("");
  const [propertyId, setPropertyId] = useState("");

  const {
    viewings,
    propertyOptions,
    leads,
    properties,
    allRooms,
    viewingsLoading,
    initialLoading,
    createViewing,
    updateViewingStatus,
    rescheduleViewing,
    respondToRequest,
  } = useViewingsData({ status: filter, person, propertyId });

  const [rescheduling, setRescheduling] = useState(null);

  const days = [...new Set(viewings.map((v) => v.date))].sort();

  if (authLoading || initialLoading)
    return <div className="p-8 text-center text-gray-500">Loading data...</div>;
  if (!user)
    return <div className="p-8 text-center text-red-500">Please log in.</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> Schedule
          </button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 flex-wrap">
          {["", "scheduled", "done", "cancelled"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${
                filter === s
                  ? "bg-[#0F253B] text-white border-[#0F253B]"
                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Search lead, agent or scheduler…"
              aria-label="Filter viewings by person — lead, agent or the member who scheduled it"
              className="w-full sm:w-72 pl-9 pr-3 py-2 text-sm font-medium bg-white border border-gray-100 rounded-lg outline-none transition-all focus:ring-2 focus:ring-[#F47C3C]"
            />
          </div>

          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            aria-label="Filter viewings by property"
            className="w-full sm:w-56 px-3 py-2 text-sm font-medium bg-white border border-gray-100 rounded-lg outline-none transition-all focus:ring-2 focus:ring-[#F47C3C]"
          >
            <option value="">All properties</option>
            {propertyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {(person || propertyId) && (
            <button
              onClick={() => {
                setPerson("");
                setPropertyId("");
              }}
              className="px-3 py-2 text-xs font-bold text-gray-500 bg-white border border-gray-100 rounded-lg hover:bg-gray-50 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {viewingsLoading ? (
        <div className="p-12 text-center text-gray-500">Loading viewings...</div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                {prettyDay(day)}
              </p>
              <div className="space-y-3">
                {viewings
                  .filter((v) => v.date === day)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((v) => (
                    <div
                      key={v._id}
                      className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start gap-5">
                        <div className="flex-shrink-0 w-20 text-center pt-1">
                          <Clock size={22} className="text-[#F47C3C] mx-auto" />
                          <div className="font-bold text-xl mt-1 text-[#0F253B]">
                            {v.time}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-lg text-[#0F253B]">
                              {v.lead?.name || v.lead}
                            </div>
                            <Badge
                              tone={STATUS_TONE[v.status]}
                              className="capitalize"
                            >
                              {v.status}
                            </Badge>
                            {v.rescheduleHistory?.length > 0 && (
                              <span
                                title={v.rescheduleHistory
                                  .map(
                                    (h) =>
                                      `${h.fromDate} ${h.fromTime} → ${h.toDate} ${h.toTime}${
                                        h.reason ? ` (${h.reason})` : ""
                                      }`
                                  )
                                  .join("\n")}
                                className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
                              >
                                Rescheduled {v.rescheduleHistory.length}×
                              </span>
                            )}
                          </div>

                          <div className="mt-2 text-sm text-gray-600 flex items-center gap-1.5">
                            <MapPin size={16} className="text-gray-400" />
                            <span>{v.property?.name || v.property}</span>
                            {v.room && <span className="text-gray-400">•</span>}
                            <span>
                              {v.room?.roomName || v.room?.title || v.room}
                            </span>
                          </div>

                          {v.lead && (
                            <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                              {v.lead.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail size={16} className="text-gray-400" />
                                  <span>{v.lead.email}</span>
                                </div>
                              )}
                              {v.lead.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone size={16} className="text-gray-400" />
                                  <span>{v.lead.phone}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {v.rescheduleRequest?.status === "pending" && (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                              <p className="text-xs font-bold text-amber-800">
                                Tenant requested{" "}
                                {v.rescheduleRequest.requestedDate} at{" "}
                                {v.rescheduleRequest.requestedTime}
                              </p>
                              {v.rescheduleRequest.reason && (
                                <p className="mt-0.5 text-xs text-amber-700 font-medium">
                                  {v.rescheduleRequest.reason}
                                </p>
                              )}
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() =>
                                    respondToRequest(v._id, "approve")
                                  }
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-green-700"
                                >
                                  Approve &amp; move
                                </button>
                                <button
                                  onClick={() =>
                                    respondToRequest(v._id, "decline")
                                  }
                                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-gray-500 font-medium">
                            {v.agent}
                          </div>
                          <AddedBy record={v} verb="Scheduled by" />

                          {v.status === "scheduled" && (
                            <div className="flex gap-1 mt-2">
                              <button
                                onClick={() => setRescheduling(v)}
                                className="p-2 text-[#F47C3C] hover:bg-orange-50 rounded-xl transition-colors"
                                title="Reschedule"
                              >
                                <CalendarClock size={20} />
                              </button>
                              <button
                                onClick={() =>
                                  updateViewingStatus(v._id, "done")
                                }
                                className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                                title="Mark as Done"
                              >
                                <CheckCircle size={20} />
                              </button>
                              <button
                                onClick={() =>
                                  updateViewingStatus(v._id, "cancelled")
                                }
                                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                title="Cancel Viewing"
                              >
                                <XCircle size={20} />
                              </button>
                            </div>
                          )}

                          {v.status === "done" && (
                            <div className="flex gap-1 mt-2">
                              <button
                                onClick={() =>
                                  updateViewingStatus(v._id, "scheduled")
                                }
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                title="Re-open (undo Done)"
                              >
                                <RotateCcw size={16} /> Re-open
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {viewings.length === 0 && (
            <p className="text-center py-20 text-gray-400 text-lg">
              No viewings found.
            </p>
          )}
        </div>
      )}

      {rescheduling && (
        <RescheduleModal
          viewing={rescheduling}
          onClose={() => setRescheduling(null)}
          onConfirm={async (payload) => {
            await rescheduleViewing(rescheduling._id, payload);
            setRescheduling(null);
          }}
        />
      )}

      {open && (
        <ViewingModal
          onClose={() => setOpen(false)}
          onCreate={createViewing}
          leads={leads}
          properties={properties}
          allRooms={allRooms}
        />
      )}
    </div>
  );
}