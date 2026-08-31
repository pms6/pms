"use client";

import { useEffect, useState } from "react";
import { CalendarClock, RefreshCw, Search, Download } from "lucide-react";

export default function AvailableRoomsPage() {
  const [availableNow, setAvailableNow] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [summary, setSummary] = useState({
    availableNowCount: 0,
    comingSoonCount: 0,
    daysAhead: 60,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [daysAhead, setDaysAhead] = useState(60);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

  const fetchAvailableRooms = async () => {
    try {
      setLoading(true);
      setError(null);

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        "";

      const res = await fetch(
        `${API_BASE}/rooms/available?daysAhead=${daysAhead}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          credentials: "include",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load available rooms");
      }

      setAvailableNow(json.data.availableNow || []);
      setComingSoon(json.data.comingSoon || []);
      setSummary(
        json.data.summary || {
          availableNowCount: 0,
          comingSoonCount: 0,
          daysAhead,
        }
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableRooms();
  }, [daysAhead]);

  const filterRows = (rows) => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.propertyName?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.area?.toLowerCase().includes(q) ||
        r.exTenant?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
    );
  };

  const filteredAvailableNow = filterRows(availableNow);
  const filteredComingSoon = filterRows(comingSoon);

  const RoomTable = ({ rows, emptyMessage }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-5 py-3.5">#</th>
            <th className="px-5 py-3.5">Property</th>
            <th className="px-5 py-3.5">Code</th>
            <th className="px-5 py-3.5">Area</th>
            <th className="px-5 py-3.5">Zone</th>
            <th className="px-5 py-3.5">Price</th>
            <th className="px-5 py-3.5">Deposit</th>
            <th className="px-5 py-3.5">Ex-Tenant</th>
            <th className="px-5 py-3.5">Occupancy</th>
            <th className="px-5 py-3.5">Bank</th>
            <th className="px-5 py-3.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className="px-5 py-16 text-center text-sm text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.roomId || idx}
                className="hover:bg-gray-50/80 transition-colors"
              >
                <td className="px-5 py-4 text-gray-400">{idx + 1}</td>
                <td className="px-5 py-4 font-medium text-gray-900">
                  {row.propertyName}
                </td>
                <td className="px-5 py-4 text-gray-600">{row.code}</td>
                <td className="px-5 py-4 text-gray-600">{row.area}</td>
                <td className="px-5 py-4 text-gray-600">{row.zone || "—"}</td>
                <td className="px-5 py-4 font-medium text-gray-900">
                  {row.price}
                </td>
                <td className="px-5 py-4 text-gray-600">{row.deposit}</td>
                <td className="px-5 py-4 text-gray-600">{row.exTenant}</td>
                <td className="px-5 py-4 text-gray-600">{row.occupancy}</td>
                <td className="px-5 py-4 text-gray-600">{row.bank || "—"}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      row.status === "Available Now"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {row.status}
                  </span>
                  {row.notes && (
                    <p className="mt-1 text-xs text-gray-400">{row.notes}</p>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header – matches Void Periods */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Available Rooms
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track rooms that are available now or becoming free soon.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value))}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          >
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
            <option value={120}>Next 120 days</option>
          </select>

          <button
            onClick={fetchAvailableRooms}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards – same style as Void Periods */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Primary dark card */}
        <div className="rounded-2xl bg-[#0f172a] p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Available Now
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {summary.availableNowCount}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <CalendarClock className="h-5 w-5 text-orange-400" />
            </div>
          </div>
        </div>

        {/* White cards */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Coming Soon
              </p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {summary.comingSoonCount}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
              <CalendarClock className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Looking Ahead
              </p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {summary.daysAhead}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">days</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
              <CalendarClock className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Total Rooms
              </p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {summary.availableNowCount + summary.comingSoonCount}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
              <CalendarClock className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search property, code, area or tenant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Available Now card */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                Available Now
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {filteredAvailableNow.length} Rooms
              </span>
            </div>
            <RoomTable
              rows={filteredAvailableNow}
              emptyMessage="No rooms available right now"
            />
          </div>

          {/* Coming Soon card */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                Coming Soon
              </h2>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {filteredComingSoon.length} Rooms
              </span>
            </div>
            <RoomTable
              rows={filteredComingSoon}
              emptyMessage="No rooms coming available in the selected period"
            />
          </div>
        </div>
      )}
    </div>
  );
}