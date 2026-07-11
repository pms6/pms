"use client";

import { useState, useEffect } from "react";
import {
  Search,
  CalendarDays,
  Filter,
  ClipboardCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
} from "lucide-react";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";

export default function InspectionsPage() {
  const { user } = useAuth();

  const [inspections, setInspections] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    type: "ROUTINE",
    propertyId: "",
    roomId: "",
    inspector: user?._id || "",
    notes: "",
  });

  // Fetch Properties & Rooms
  const fetchDropdownData = async () => {
    try {
      const [propRes, roomRes] = await Promise.all([
        api.get("/properties"),
        api.get("/rooms"),
      ]);
      setProperties(propRes.data.data || propRes.data || []);
      setRooms(roomRes.data.data || roomRes.data || []);
    } catch (err) {
      console.error("Failed to load dropdown data:", err);
    }
  };

  // Fetch Inspections
  const fetchInspections = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      const params = {
        upcoming: upcomingOnly ? "true" : undefined,
        status: statusFilter || undefined,
      };

      const response = await api.get("/inspections", { params });
      let data = response.data.data || [];

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter((insp) =>
          [
            insp.propertyId?.name,
            insp.roomId?.roomName,
            insp.inspector?.name,
            insp.notes,
          ].some((field) => field?.toLowerCase().includes(term))
        );
      }

      setInspections(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load inspections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
    fetchDropdownData();
  }, [user, statusFilter, upcomingOnly]);

  useEffect(() => {
    const timeout = setTimeout(fetchInspections, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Open Edit Modal
  const openEditModal = (inspection) => {
    setEditingId(inspection._id);
    setFormData({
      title: inspection.title || "",
      date: inspection.date ? new Date(inspection.date).toISOString().slice(0, 16) : "",
      type: inspection.type || "ROUTINE",
      propertyId: inspection.propertyId?._id || "",
      roomId: inspection.roomId?._id || "",
      inspector: inspection.inspector?._id || user?._id || "",
      notes: inspection.notes || "",
    });
    setShowEditModal(true);
  };

  // Create Inspection
  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = { ...formData };
    if (!payload.propertyId) delete payload.propertyId;
    if (!payload.roomId) delete payload.roomId;
    if (!payload.inspector) delete payload.inspector;

    try {
      await api.post("/inspections", payload);
      alert("Inspection scheduled successfully!");
      setShowCreateModal(false);
      resetForm();
      fetchInspections();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create inspection");
    } finally {
      setSubmitting(false);
    }
  };

  // Update Inspection
  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = { ...formData };
    if (!payload.propertyId) delete payload.propertyId;
    if (!payload.roomId) delete payload.roomId;
    if (!payload.inspector) delete payload.inspector;

    try {
      await api.put(`/inspections/${editingId}`, payload);
      alert("Inspection updated successfully!");
      setShowEditModal(false);
      resetForm();
      fetchInspections();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      date: "",
      type: "ROUTINE",
      propertyId: "",
      roomId: "",
      inspector: user?._id || "",
      notes: "",
    });
    setEditingId(null);
  };

  // Complete & Delete
  const handleComplete = async (id) => {
    if (!confirm("Mark this inspection as completed?")) return;
    try {
      await api.patch(`/inspections/${id}/complete`);
      fetchInspections();
    } catch (err) {
      alert("Failed to complete inspection");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this inspection?")) return;
    try {
      await api.delete(`/inspections/${id}`);
      fetchInspections();
    } catch (err) {
      alert("Failed to delete inspection");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED": return "bg-green-100 text-green-700";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-700";
      case "OVERDUE": return "bg-red-100 text-red-700";
      case "CANCELLED": return "bg-gray-100 text-gray-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inspections</h1>
              <p className="text-gray-500">View upcoming and completed property & room inspections.</p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-xl transition"
          >
            <Plus size={20} />
            Schedule Inspection
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <CalendarDays className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <select
                value={upcomingOnly ? "upcoming" : ""}
                onChange={(e) => setUpcomingOnly(e.target.value === "upcoming")}
                className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">All Time</option>
                <option value="upcoming">Upcoming Only</option>
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Status</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="OVERDUE">Overdue</option>
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search property, room or inspector..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <button
              onClick={fetchInspections}
              className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium flex items-center justify-center gap-2 transition px-4 py-3"
            >
              <Filter size={18} /> Refresh
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
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Inspector</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="py-20 text-center">Loading inspections...</td></tr>
                ) : error ? (
                  <tr><td colSpan="8" className="py-20 text-center text-red-600">{error}</td></tr>
                ) : inspections.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-20">
                      <div className="flex flex-col items-center">
                        <ClipboardCheck className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold">No inspections found</h3>
                      </div>
                    </td>
                  </tr>
                ) : (
                  inspections.map((inspection) => (
                    <tr key={inspection._id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-6 py-4">{new Date(inspection.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{inspection.propertyId?.name || "—"}</td>
                      <td className="px-6 py-4">{inspection.roomId?.roomName || "—"}</td>
                      <td className="px-6 py-4 font-medium">{inspection.type}</td>
                      <td className="px-6 py-4">{inspection.inspector?.name || "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(inspection.status)}`}>
                          {inspection.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {inspection.notes || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-center">
                          {inspection.status !== "COMPLETED" && (
                            <button onClick={() => handleComplete(inspection._id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Complete">
                              <CheckCircle size={18} />
                            </button>
                          )}
                          <button onClick={() => openEditModal(inspection)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => handleDelete(inspection._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">
              {showEditModal ? "Edit Inspection" : "Schedule New Inspection"}
            </h2>

            <form onSubmit={showEditModal ? handleUpdate : handleCreate} className="space-y-5">
              <input
                type="text"
                placeholder="Inspection Title *"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
              />

              <input
                type="datetime-local"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
              />

              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="ROUTINE">Routine</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="SAFETY">Safety</option>
                <option value="MOVE_IN">Move In</option>
                <option value="MOVE_OUT">Move Out</option>
              </select>

              <select
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Select Property (Optional)</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>

              <select
                value={formData.roomId}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Select Room (Optional)</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.roomName} - {r.title}
                  </option>
                ))}
              </select>

              <textarea
                placeholder="Notes (Optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 h-24 focus:ring-2 focus:ring-orange-500 outline-none"
              />

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium hover:bg-gray-50 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 bg-orange-600 text-white rounded-2xl font-medium hover:bg-orange-700 disabled:opacity-70 transition"
                >
                  {submitting ? "Saving..." : showEditModal ? "Update Inspection" : "Schedule Inspection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}