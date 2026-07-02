"use client";

import {
  Search,
  CalendarDays,
  Filter,
  ClipboardCheck,
} from "lucide-react";

export default function InspectionsPage() {
  const inspections = [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Inspections
            </h1>
            <p className="text-gray-500">
              View upcoming and completed property inspections.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date */}
            <div className="relative">
              <CalendarDays className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />

              <select className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500">
                <option>Last Month</option>
                <option>This Month</option>
                <option>This Week</option>
                <option>Today</option>
                <option>Custom Range</option>
              </select>
            </div>

            {/* Property */}
            <select className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500">
              <option>All Properties</option>
              <option>Property A</option>
              <option>Property B</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />

              <input
                type="text"
                placeholder="Search property or room..."
                className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Button */}
            <button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition px-4 py-3">
              <Filter size={18} />
              Filter
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-sm font-semibold text-gray-600">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Property</th>
                  <th className="px-6 py-4">Room</th>
                  <th className="px-6 py-4">Inspection Type</th>
                  <th className="px-6 py-4">Inspector</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                </tr>
              </thead>

              <tbody>
                {inspections.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-20">
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-5">
                          <ClipboardCheck className="h-10 w-10 text-blue-500" />
                        </div>

                        <h2 className="text-xl font-semibold text-gray-900">
                          No inspections found
                        </h2>

                        <p className="text-gray-500 mt-2 max-w-md text-center">
                          There are currently no inspections matching your
                          selected filters.
                        </p>

                        <button className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition">
                          Schedule Inspection
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  inspections.map((inspection) => (
                    <tr
                      key={inspection.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">{inspection.date}</td>
                      <td className="px-6 py-4">{inspection.property}</td>
                      <td className="px-6 py-4">{inspection.room}</td>
                      <td className="px-6 py-4">{inspection.type}</td>
                      <td className="px-6 py-4">{inspection.inspector}</td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-medium">
                          {inspection.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">{inspection.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}