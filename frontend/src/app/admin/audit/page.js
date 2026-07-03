"use client";

import { useState } from "react";
import {
  ClipboardList,
  Search,
  Plus,
  Calendar,
  X,
} from "lucide-react";

export default function AuditLogPage() {
  const [logs] = useState([
    {
      id: 1,
      category: "Organisation Note",
      title: "test",
      user: "Gabriel Stephens",
      date: "26/06/26 14:15",
    },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-blue-600" />
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Audit Log
            </h1>

            <p className="text-gray-500 mt-1">
              View activity and changes across your organisation.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Category */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Category
              </label>

              <select className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <option>Manual notes only</option>
                <option>All activity</option>
              </select>
            </div>

            {/* Team */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Team Member
              </label>

              <select className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <option>All organisation users</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Date Range
              </label>

              <div className="relative">
                <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />

                <select className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option>All Time</option>
                  <option>Today</option>
                  <option>This Week</option>
                  <option>This Month</option>
                </select>
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Search
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />

                <input
                  placeholder="Start typing..."
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Button */}
            <div className="flex items-end">
              <button className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium flex items-center justify-center gap-2 transition">
                <Plus size={18} />
                Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-5 border rounded-2xl p-6 hover:shadow-md transition mb-4"
            >
              <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center">
                <ClipboardList className="text-blue-600" />
              </div>

              <div className="flex-1">
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">
                  {log.category}
                </span>

                <h3 className="text-xl font-semibold text-gray-900 mt-3">
                  {log.title}
                </h3>

                <p className="text-gray-500 mt-2">
                  Added on{" "}
                  <span className="font-medium">{log.date}</span> by{" "}
                  <span className="text-blue-600 font-medium">
                    {log.user}
                  </span>
                </p>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="py-20 text-center">
              <ClipboardList className="mx-auto h-14 w-14 text-gray-300" />

              <h3 className="mt-4 text-xl font-semibold">
                No activity found
              </h3>

              <p className="text-gray-500 mt-2">
                There are no audit logs matching your filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}