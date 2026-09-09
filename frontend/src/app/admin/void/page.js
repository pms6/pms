"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  DoorOpen,
  Download,
  Filter,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import api from "../../api/api";
import { PageHeader, StatCard, Badge } from "../../Shared/ui";

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const rate = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value || 0));

const dayLabel = (days) => `${days} ${Number(days) === 1 ? "day" : "days"}`;

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", { timeZone: "UTC" });
};

const DAY_MS = 86400000;

// A date value → the UTC midnight that starts its day, as a millisecond marker.
// Void dates are whole days, so everything below works in day units.
const dayStartMs = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? NaN
    : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// Whole days shared by the void [vStart..vEnd] and the window [wStart..wEnd].
// All four are day-start markers and both ends are inclusive — a void from the
// 9th to the 9th is one day, and a void that only clips the last day of a
// window contributes one day, not its whole length.
const overlapDays = (vStart, vEnd, wStart, wEnd) => {
  const s = Math.max(vStart, wStart);
  const e = Math.min(vEnd, wEnd);
  return e < s ? 0 : Math.round((e - s) / DAY_MS) + 1;
};

// The [start, end] day-marker window for a period-filter choice, or null for
// "all" / an incomplete "specific month". Windows are UTC and inclusive.
const periodWindow = (periodType, selectedMonth, now = new Date()) => {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const monthEnd = (yy, mm) => Date.UTC(yy, mm + 1, 0);

  switch (periodType) {
    case "all":
      return null;
    case "today":
      return [Date.UTC(y, m, d), Date.UTC(y, m, d)];
    case "week": {
      const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
      const weekS = Date.UTC(y, m, d - dow);
      return [weekS, weekS + 6 * DAY_MS];
    }
    case "thisMonth":
      return [Date.UTC(y, m, 1), monthEnd(y, m)];
    case "thisYear":
      return [Date.UTC(y, 0, 1), Date.UTC(y, 11, 31)];
    case "6months":
      return [Date.UTC(y, m - 5, 1), monthEnd(y, m)];
    case "12months":
      return [Date.UTC(y, m - 11, 1), monthEnd(y, m)];
    case "month": {
      if (!selectedMonth) return null;
      const [yy, mm] = selectedMonth.split("-").map(Number);
      if (!yy || !mm) return null;
      return [Date.UTC(yy, mm - 1, 1), monthEnd(yy, mm - 1)];
    }
    default:
      return null;
  }
};

const calculateVoidMetrics = (room, startDate, endDate) => {
  const rent = Number(room?.monthlyRent || 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!startDate || !endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { dailyRent: 0, voidDays: 0, totalVoid: 0 };
  }

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const voidDays = Math.max(1, Math.round(diffMs / 86400000) + 1);

  const exactDaily = rent / 30;
  const dailyRent = Number(exactDaily.toFixed(4));
  const totalVoid = Number((exactDaily * voidDays).toFixed(2));

  return { dailyRent, voidDays, totalVoid };
};

export default function AdminVoidPage() {
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [voidPeriods, setVoidPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  // Quick length band — "" | "daily" | "weekly" | "monthly". A void is Daily if
  // it lasted a single day, Weekly if 2–7, Monthly if 8 or more.
  const [lengthBucket, setLengthBucket] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const formRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);
  const [lastVoid, setLastVoid] = useState(null);

  // Period filter
  const [periodType, setPeriodType] = useState("all"); // "all" | "month" | "6months" | "12months"
  const [selectedMonth, setSelectedMonth] = useState(""); // "2025-08"

  const [form, setForm] = useState({
    propertyId: "",
    roomId: "",
    tenantName: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [propertiesRes, roomsRes, voidRes] = await Promise.all([
          api.get("/properties", { params: { limit: 1000 } }),
          api.get("/rooms", { params: { limit: 1000 } }),
          api.get("/void-periods", { params: { includeDeleted: showHistory } }),
        ]);

        if (cancelled) return;

        const props = propertiesRes.data?.data ?? [];
        const roomList = roomsRes.data?.data ?? [];
        const periods = voidRes.data?.data ?? [];

        setProperties(props);
        setRooms(roomList);
        setVoidPeriods(periods);

        setForm((current) => {
          if (current.propertyId || props.length === 0) return current;
          const first = props[0];
          const firstRoom = roomList.find((room) => {
            const rid =
              room.propertyId && typeof room.propertyId === "object"
                ? room.propertyId._id
                : room.propertyId;
            return String(rid) === String(first._id);
          });
          return { ...current, propertyId: first._id, roomId: firstRoom?._id || "" };
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Failed to load void data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [showHistory]);

  // Load last void whenever the selected room changes
  useEffect(() => {
    if (!form.roomId || editingId) {
      setLastVoid(null);
      return;
    }

    let cancelled = false;
    api
      .get(`/void-periods/room/${form.roomId}/last`)
      .then((res) => {
        if (!cancelled) setLastVoid(res.data?.data || null);
      })
      .catch(() => {
        if (!cancelled) setLastVoid(null);
      });

    return () => {
      cancelled = true;
    };
  }, [form.roomId, editingId]);

  const roomOptions = useMemo(
    () =>
      rooms.filter((room) => {
        const roomPropertyId =
          room.propertyId && typeof room.propertyId === "object"
            ? room.propertyId._id
            : room.propertyId;
        return !form.propertyId || String(roomPropertyId) === String(form.propertyId);
      }),
    [rooms, form.propertyId]
  );

  useEffect(() => {
    if (roomOptions.length === 0) {
      setForm((current) => ({ ...current, roomId: "" }));
      return;
    }

    const currentSelectionExists = roomOptions.some(
      (room) => String(room._id) === String(form.roomId)
    );
    if (!currentSelectionExists) {
      setForm((current) => ({ ...current, roomId: roomOptions[0]._id }));
    }
  }, [roomOptions, form.roomId]);

  const selectedRoom = useMemo(
    () =>
      roomOptions.find((room) => String(room._id) === String(form.roomId)) ||
      roomOptions[0] ||
      null,
    [roomOptions, form.roomId]
  );

  const preview = useMemo(() => {
    if (!selectedRoom || !form.startDate || !form.endDate) {
      return null;
    }
    return calculateVoidMetrics(selectedRoom, form.startDate, form.endDate);
  }, [selectedRoom, form.startDate, form.endDate]);

  // The window the period filter is currently pointing at, or null for "all"
  // time (and for "specific month" before a month is picked).
  const activeWindow = useMemo(
    () => periodWindow(periodType, selectedMonth),
    [periodType, selectedMonth]
  );
  // "Specific month" chosen but no month set yet → the table shows nothing.
  const periodPending = periodType === "month" && !selectedMonth;

  // A void belongs to the selected period when its OWN date range overlaps that
  // window — not merely when it started inside it. A void that ran from last
  // month into this week still counts as "this week".
  const isInSelectedPeriod = (period) => {
    if (!activeWindow) return !periodPending;
    const s = dayStartMs(period.startDate);
    const e = dayStartMs(period.endDate);
    if (Number.isNaN(s) || Number.isNaN(e)) return false;
    return s <= activeWindow[1] && e >= activeWindow[0];
  };

  // Everything EXCEPT the period dropdown: property, search, length and the
  // exact-days filter. This is the scope the summary cards read from — the
  // day / week / month / year cards each carry their own window, so the period
  // dropdown must not narrow them; it only narrows the table below.
  const matchesNonPeriod = (item) => {
    if (dayFilter && Number(item.voidDays || 0) !== Number(dayFilter)) return false;

    if (lengthBucket) {
      const d = Number(item.voidDays || 0);
      if (lengthBucket === "daily" && d > 1) return false;
      if (lengthBucket === "weekly" && (d < 2 || d > 7)) return false;
      if (lengthBucket === "monthly" && d < 8) return false;
    }

    if (propertyFilter) {
      const pid =
        item.propertyId && typeof item.propertyId === "object"
          ? item.propertyId._id
          : item.propertyId;
      if (String(pid) !== String(propertyFilter)) return false;
    }

    const needle = search.trim().toLowerCase();
    if (needle) {
      const room = item.roomId && typeof item.roomId === "object" ? item.roomId : null;
      const haystack = [
        item.tenantName,
        item.roomCode,
        item.notes,
        room?.roomName,
        room?.roomNumber,
        item.propertyId?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  };

  const scopedPeriods = useMemo(
    () => voidPeriods.filter(matchesNonPeriod),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voidPeriods, dayFilter, lengthBucket, propertyFilter, search]
  );

  // The table also honours the period dropdown.
  const visiblePeriods = useMemo(
    () => scopedPeriods.filter(isInSelectedPeriod),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedPeriods, periodType, selectedMonth]
  );

  // Active only (removed voids are history — they no longer bleed).
  const scopedActive = useMemo(
    () => scopedPeriods.filter((item) => !item.isDeleted),
    [scopedPeriods]
  );

  const dayOptions = useMemo(
    () =>
      [
        ...new Set(
          voidPeriods.map((item) => Number(item.voidDays || 0)).filter((d) => d > 0)
        ),
      ].sort((a, b) => a - b),
    [voidPeriods]
  );

  // Void loss inside a window [wStart, wEnd] over `rows`: for each void, only
  // the days its OWN date range overlaps the window × that room's daily rate.
  // So "this week" counts just the void days that land in this week, "today"
  // counts only rooms empty today, and a void spanning a window edge is clipped
  // rather than counted in full.
  const windowLoss = (rows, wStart, wEnd) =>
    rows.reduce((sum, item) => {
      const vS = dayStartMs(item.startDate);
      const vE = dayStartMs(item.endDate);
      if (Number.isNaN(vS) || Number.isNaN(vE)) return sum;
      const room = item.roomId && typeof item.roomId === "object" ? item.roomId : null;
      const rentAmount = Number(item.rentAmount || room?.monthlyRent || 0);
      const daily = Number(item.dailyRent) || rentAmount / 30;
      const days = overlapDays(vS, vE, wStart, wEnd);
      return sum + days * (Number.isFinite(daily) ? daily : 0);
    }, 0);

  // The four summary windows — today, this ISO week, this calendar month, this
  // calendar year — each measured against every void in scope. Independent of
  // the period dropdown.
  const { voidPerDay, voidPerWeek, voidPerMonth, voidPerYear } = useMemo(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();

    const todayS = Date.UTC(y, m, d);
    const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
    const weekS = Date.UTC(y, m, d - dow);
    const monthS = Date.UTC(y, m, 1);
    const monthE = Date.UTC(y, m + 1, 0);
    const yearS = Date.UTC(y, 0, 1);
    const yearE = Date.UTC(y, 11, 31);

    return {
      voidPerDay: windowLoss(scopedActive, todayS, todayS),
      voidPerWeek: windowLoss(scopedActive, weekS, weekS + 6 * DAY_MS),
      voidPerMonth: windowLoss(scopedActive, monthS, monthE),
      voidPerYear: windowLoss(scopedActive, yearS, yearE),
    };
  }, [scopedActive]);

  // Card totals — the whole picture for the rooms in scope, unaffected by the
  // period dropdown. The money total keeps removed voids (the loss happened).
  const totalVoid = useMemo(
    () =>
      scopedPeriods.reduce(
        (sum, item) => sum + Number(item.totalVoid || item.total || 0),
        0
      ),
    [scopedPeriods]
  );
  const totalDays = useMemo(
    () => scopedPeriods.reduce((sum, item) => sum + Number(item.voidDays || 0), 0),
    [scopedPeriods]
  );

  // Period-scoped figures for the table banner: when a window is active the
  // loss is CLIPPED to it, so "August" shows August's days of a void that ran
  // from July, not the void's whole total.
  const periodStats = useMemo(() => {
    const active = visiblePeriods.filter((p) => !p.isDeleted);
    const removed = visiblePeriods.length - active.length;
    const days = visiblePeriods.reduce((s, p) => s + Number(p.voidDays || 0), 0);
    const loss = activeWindow
      ? windowLoss(visiblePeriods, activeWindow[0], activeWindow[1])
      : visiblePeriods.reduce(
          (s, p) => s + Number(p.totalVoid || p.total || 0),
          0
        );
    return { activeCount: active.length, removed, days, loss };
  }, [visiblePeriods, activeWindow]);

  const stats = [
    { label: "Total Void", value: money(totalVoid), icon: CalendarRange, tone: "navy", sub: "all voids for these rooms" },
    { label: "Void / Day", value: rate(voidPerDay), icon: CalendarRange, tone: "light", sub: "rooms empty today" },
    { label: "Void / Week", value: money(voidPerWeek), icon: CalendarRange, tone: "light", sub: "void loss this week" },
    { label: "Void / Month", value: money(voidPerMonth), icon: CalendarRange, tone: "light", sub: "void loss this month" },
    { label: "Void / Year", value: money(voidPerYear), icon: CalendarRange, tone: "light", sub: "void loss this year" },
    { label: "Void Periods", value: scopedActive.length, icon: DoorOpen, tone: "light" },
    { label: "Void Days", value: totalDays, icon: CalendarRange, tone: "light" },
  ];

  const handleField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submitVoid = async (event) => {
    event.preventDefault();

    if (!selectedRoom || !form.startDate || !form.endDate) {
      setError("Choose a room and complete both dates before saving.");
      return;
    }

    if (selectedRoom.status === "OCCUPIED") {
      setError(
        "This room is currently occupied. You cannot record a void while it is let."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        propertyId: form.propertyId,
        roomId: selectedRoom._id,
        tenantName: form.tenantName,
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes,
      };

      if (editingId) {
        const response = await api.put(`/void-periods/${editingId}`, payload);
        const saved = response.data.data;
        setVoidPeriods((current) =>
          current.map((item) => (item._id === editingId ? saved : item))
        );
        setEditingId(null);
      } else {
        const response = await api.post("/void-periods", payload);
        setVoidPeriods((current) => [response.data.data, ...current]);
      }

      setForm((current) => ({
        ...current,
        tenantName: "",
        startDate: "",
        endDate: "",
        notes: "",
      }));
      setLastVoid(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save void period.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (period) => {
    const pid =
      period.propertyId && typeof period.propertyId === "object"
        ? period.propertyId._id
        : period.propertyId;
    const rid =
      period.roomId && typeof period.roomId === "object"
        ? period.roomId._id
        : period.roomId;

    setEditingId(period._id);
    setForm({
      propertyId: String(pid || ""),
      roomId: String(rid || ""),
      tenantName: period.tenantName || "",
      startDate: period.startDate ? String(period.startDate).slice(0, 10) : "",
      endDate: period.endDate ? String(period.endDate).slice(0, 10) : "",
      notes: period.notes || "",
    });
    setError("");
    setLastVoid(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
    setForm((current) => ({
      ...current,
      tenantName: "",
      startDate: "",
      endDate: "",
      notes: "",
    }));
    setLastVoid(null);
  };

  const exportCsv = () => {
    const rows = [
      [
        "Property",
        "Room",
        "Client",
        "Monthly rent",
        "Daily rent",
        "Start",
        "End",
        "Days",
        "Total void",
        "Notes",
        "Status",
      ],
      ...visiblePeriods.map((p) => {
        const room = p.roomId && typeof p.roomId === "object" ? p.roomId : null;
        return [
          getPropertyName(p.propertyId),
          p.roomCode || room?.roomNumber || room?.roomName || "",
          p.tenantName || "",
          p.rentAmount ?? "",
          p.dailyRent ?? "",
          formatDate(p.startDate),
          formatDate(p.endDate),
          p.voidDays ?? "",
          p.totalVoid ?? "",
          (p.notes || "").replace(/\s+/g, " "),
          p.isDeleted ? "Removed" : "Active",
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `void-periods-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const removeVoid = async (id) => {
    if (!confirm("Remove this void period? It stays in the history.")) return;

    try {
      await api.delete(`/void-periods/${id}`);
      setVoidPeriods((current) =>
        showHistory
          ? current.map((item) =>
              item._id === id
                ? { ...item, isDeleted: true, deletedAt: new Date().toISOString() }
                : item
            )
          : current.filter((item) => item._id !== id)
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove void period.");
    }
  };

  const restoreVoid = async (id) => {
    try {
      const response = await api.patch(`/void-periods/${id}/restore`);
      const restored = response.data?.data;
      setVoidPeriods((current) =>
        current.map((item) =>
          item._id === id
            ? { ...(restored || item), isDeleted: false, deletedAt: null }
            : item
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to restore void period.");
    }
  };

  const getPropertyName = (propertyId) => {
    if (propertyId && typeof propertyId === "object" && propertyId.name) {
      return propertyId.name;
    }

    const resolvedPropertyId =
      propertyId && typeof propertyId === "object" ? propertyId._id : propertyId;
    const match = properties.find(
      (property) => String(property._id) === String(resolvedPropertyId)
    );
    return match?.name || "Property";
  };

  const continueFromLastVoid = () => {
    if (!lastVoid?.endDate) return;
    const nextDay = new Date(lastVoid.endDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    setForm((c) => ({
      ...c,
      startDate: nextDay.toISOString().slice(0, 10),
      endDate: "",
    }));
  };

  // Human-readable label for the current period
  const periodLabel = (() => {
    if (periodType === "month" && selectedMonth) {
      return new Date(selectedMonth + "-01").toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    if (periodType === "today") return "Today";
    if (periodType === "week") return "This week";
    if (periodType === "thisMonth") return "This month";
    if (periodType === "thisYear") return "This year";
    if (periodType === "6months") return "Last 6 months";
    if (periodType === "12months") return "Last 12 months";
    return "All time";
  })();

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-gray-100 bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#F47C3C]/30 border-t-[#F47C3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Void Periods"
        subtitle="Track room void periods and auto-calculate the daily and total loss automatically."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={visiblePeriods.length === 0}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-[#0F253B] hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Export
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                cancelEdit();
                formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-xl bg-[#0F253B] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1d3557]"
            >
              <span className="inline-flex items-center gap-2">
                <Plus size={16} /> Add void period
              </span>
            </button>
          </div>
        }
      />

      {/* Main stats – now include history (removed voids) in the money total */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            sub={item.sub}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {/* Form */}
        <form
          ref={formRef}
          onSubmit={submitVoid}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 scroll-mt-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0F253B]">
              {editingId ? "Edit void period" : "Void period"}
            </h2>
            <Badge tone={editingId ? "blue" : "orange"}>
              {editingId ? "Editing" : "Auto-calculated"}
            </Badge>
          </div>

          {properties.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              No properties are linked to your organisation yet. Add a property first — a
              void period is always recorded against one of your own rooms.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-gray-600">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Property
              </span>
              <select
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 outline-none focus:border-[#F47C3C] focus:bg-white disabled:opacity-60"
                value={form.propertyId}
                onChange={handleField("propertyId")}
                disabled={properties.length === 0}
              >
                {properties.length === 0 ? (
                  <option value="">No properties in your organisation</option>
                ) : (
                  properties.map((property) => (
                    <option key={property._id} value={property._id}>
                      {property.name}
                      {property.propertyCode ? ` · ${property.propertyCode}` : ""}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-gray-600">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Room
              </span>
              <select
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 outline-none focus:border-[#F47C3C] focus:bg-white disabled:opacity-60"
                value={form.roomId}
                onChange={handleField("roomId")}
                disabled={roomOptions.length === 0}
              >
                {roomOptions.length === 0 ? (
                  <option value="">No rooms in this property</option>
                ) : (
                  roomOptions.map((room) => (
                    <option
                      key={room._id}
                      value={room._id}
                      disabled={room.status === "OCCUPIED"}
                    >
                      {room.roomName || room.roomNumber || "Room"}
                      {room.status === "OCCUPIED" ? " (Occupied)" : ""}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-gray-600">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Start date
              </span>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 outline-none focus:border-[#F47C3C] focus:bg-white"
                value={form.startDate}
                onChange={handleField("startDate")}
              />
            </label>

            <label className="space-y-1.5 text-sm font-medium text-gray-600">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                End date
              </span>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 outline-none focus:border-[#F47C3C] focus:bg-white"
                value={form.endDate}
                onChange={handleField("endDate")}
              />
            </label>

            <label className="space-y-1.5 text-sm font-medium text-gray-600 md:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Tenant name
              </span>
              <input
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 outline-none focus:border-[#F47C3C] focus:bg-white"
                value={form.tenantName}
                onChange={handleField("tenantName")}
                placeholder="e.g. Rajika"
              />
            </label>

            <label className="space-y-1.5 text-sm font-medium text-gray-600 md:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Notes
              </span>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 outline-none focus:border-[#F47C3C] focus:bg-white"
                value={form.notes}
                onChange={handleField("notes")}
                placeholder="Optional note about the void period"
              />
            </label>
          </div>

          {/* Last void helper */}
          {lastVoid && !editingId && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-medium text-blue-800">
                Last void for this room:{" "}
                {formatDate(lastVoid.startDate)} → {formatDate(lastVoid.endDate)} (
                {dayLabel(lastVoid.voidDays)}) · {money(lastVoid.totalVoid)}
              </p>
              <button
                type="button"
                onClick={continueFromLastVoid}
                className="mt-2 text-xs font-bold text-blue-700 underline hover:text-blue-900"
              >
                Start new void the day after last one ended
              </button>
            </div>
          )}

          {selectedRoom?.status === "OCCUPIED" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              This room is currently occupied. You cannot record a void while it is let.
            </div>
          )}

          {selectedRoom && preview && selectedRoom.status !== "OCCUPIED" && (
            <div className="rounded-2xl border border-dashed border-[#F47C3C]/40 bg-orange-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#F47C3C]">
                Calculated
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">Rent</p>
                  <p className="text-lg font-bold text-[#0F253B]">
                    {money(selectedRoom.monthlyRent || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">
                    Per day
                  </p>
                  <p className="text-lg font-bold text-[#0F253B]">
                    {rate(preview.dailyRent)}
                  </p>
                  <p className="text-[10px] font-medium text-gray-400">
                    {money(selectedRoom.monthlyRent || 0)} ÷ 30
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">Days</p>
                  <p className="text-lg font-bold text-[#0F253B]">{preview.voidDays}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-orange-100 pt-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400">
                  Total void
                </p>
                <p className="text-2xl font-bold text-[#0F253B]">
                  {money(preview.totalVoid)}
                </p>
                <p className="text-[11px] font-medium text-gray-400">
                  {rate(preview.dailyRent)} × {dayLabel(preview.voidDays)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={
                saving || !selectedRoom || selectedRoom.status === "OCCUPIED"
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#F47C3C] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              {saving
                ? "Saving..."
                : editingId
                ? "Save changes"
                : "Save void period"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table + filters */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Period
            </span>
            <select
              value={periodType}
              onChange={(e) => {
                setPeriodType(e.target.value);
                if (e.target.value !== "month") setSelectedMonth("");
              }}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#F47C3C] focus:bg-white"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="thisMonth">This month</option>
              <option value="thisYear">This year</option>
              <option value="month">Specific month</option>
              <option value="6months">Last 6 months</option>
              <option value="12months">Last 12 months</option>
            </select>

            {periodType === "month" && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#F47C3C] focus:bg-white"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Length
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              ["daily", "Daily"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setLengthBucket((current) => (current === value ? "" : value))
                }
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                  lengthBucket === value
                    ? "bg-[#0F253B] text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={dayFilter}
            onChange={(event) => setDayFilter(event.target.value)}
            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#F47C3C] focus:bg-white"
          >
            <option value="">All lengths</option>
            {dayOptions.map((days) => (
              <option key={days} value={days}>
                {dayLabel(days)}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 7].map((days) =>
              dayOptions.includes(days) ? (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    setDayFilter(String(dayFilter) === String(days) ? "" : String(days))
                  }
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    String(dayFilter) === String(days)
                      ? "bg-[#F47C3C] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {dayLabel(days)}
                </button>
              ) : null
            )}
          </div>

          <select
            value={propertyFilter}
            onChange={(event) => setPropertyFilter(event.target.value)}
            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#F47C3C] focus:bg-white"
          >
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property._id} value={property._id}>
                {property.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Client, room or note…"
              className="w-52 rounded-xl border border-gray-100 bg-gray-50 py-2 pl-8 pr-3 text-sm font-medium outline-none focus:border-[#F47C3C] focus:bg-white"
            />
          </div>

          {(dayFilter || lengthBucket || propertyFilter || search || periodType !== "all") && (
            <button
              type="button"
              onClick={() => {
                setDayFilter("");
                setLengthBucket("");
                setPropertyFilter("");
                setSearch("");
                setPeriodType("all");
                setSelectedMonth("");
              }}
              className="text-xs font-bold text-[#F47C3C] hover:underline"
            >
              Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-medium text-gray-400">
              {visiblePeriods.length} of {voidPeriods.length}
            </span>
            <button
              type="button"
              onClick={() => setShowHistory((current) => !current)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                showHistory
                  ? "bg-[#0F253B] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <History size={13} /> {showHistory ? "Hiding nothing" : "Show history"}
            </button>
          </div>
        </div>

        {/* Period total banner – includes history */}
        {periodType !== "all" && (
          <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-800">
                {periodType === "month" && !selectedMonth
                  ? "Please select a month"
                  : (
                    <>
                      Showing voids for <strong>{periodLabel}</strong>
                    </>
                  )}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                {periodStats.activeCount} active · {periodStats.removed} removed ·{" "}
                {periodStats.days} void days
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
                Void loss · {periodLabel}
              </p>
              <p className="text-xl font-bold text-blue-900">{money(periodStats.loss)}</p>
              <p className="text-[11px] font-medium text-blue-600">
                {activeWindow ? "days within this window only" : "full total"}
              </p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Rent</th>
                <th className="px-4 py-3">Per day</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeriods.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                    {voidPeriods.length === 0
                      ? "No void periods saved yet."
                      : periodType === "month" && !selectedMonth
                      ? "Please select a month."
                      : periodType !== "all"
                      ? `No void periods found for ${periodLabel}.`
                      : dayFilter && !propertyFilter && !search
                      ? `No void period lasted ${dayLabel(dayFilter)}.`
                      : "No void period matches these filters."}
                  </td>
                </tr>
              ) : (
                visiblePeriods.map((period) => {
                  const room =
                    period.roomId && typeof period.roomId === "object"
                      ? period.roomId
                      : null;
                  const durationText = `${formatDate(period.startDate)} - ${formatDate(
                    period.endDate
                  )}`;
                  const rentAmount = period.rentAmount || room?.monthlyRent || 0;
                  const daily = period.dailyRent || Number(rentAmount) / 30;

                  return (
                    <tr
                      key={period._id}
                      className={`border-t border-gray-100 align-top ${
                        period.isDeleted ? "bg-gray-50/70 text-gray-400" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#0F253B]">
                        {getPropertyName(period.propertyId)}
                        {period.isDeleted && (
                          <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            Removed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0F253B]">
                        {period.roomCode ||
                          room?.roomNumber ||
                          room?.roomName ||
                          "Room"}
                      </td>
                      <td className="px-4 py-3 text-[#0F253B]">
                        {period.tenantName || "—"}
                      </td>
                      <td className="px-4 py-3">{money(rentAmount)}</td>
                      <td className="px-4 py-3" title={`${money(rentAmount)} ÷ 30`}>
                        {rate(daily)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{durationText}</td>
                      <td className="px-4 py-3 font-bold text-[#0F253B]">
                        {dayLabel(period.voidDays || 0)}
                      </td>
                      <td
                        className="px-4 py-3 font-bold text-[#0F253B]"
                        title={`${rate(daily)} × ${period.voidDays || 0}`}
                      >
                        {money(period.totalVoid || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {period.isDeleted ? (
                          <button
                            type="button"
                            onClick={() => restoreVoid(period._id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-600"
                          >
                            <RotateCcw size={13} /> Restore
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(period)}
                              title="Edit this void period"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-[#0F253B] hover:bg-gray-100"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVoid(period._id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}