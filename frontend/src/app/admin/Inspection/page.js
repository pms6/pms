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
  Eye,
  FileText,
  Camera,
  X,
  ImagePlus,
  Loader2,
} from "lucide-react";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";
import uploadToCloudinary from "@/app/utils/uploadToCloudinary";

// Findings are the per-item checklist rows the inspector fills in on site.
const FINDING_STATUS = [
  { value: "PASS", label: "Pass", tone: "bg-green-100 text-green-700" },
  { value: "NEEDS_ATTENTION", label: "Needs Attention", tone: "bg-amber-100 text-amber-700" },
  { value: "FAIL", label: "Fail", tone: "bg-red-100 text-red-700" },
];

// Overall verdict for the visit, recorded when the report is submitted.
const OUTCOMES = [
  { value: "PASS", label: "Passed", tone: "bg-green-100 text-green-700" },
  { value: "ACTION_REQUIRED", label: "Action Required", tone: "bg-amber-100 text-amber-700" },
  { value: "FAIL", label: "Failed", tone: "bg-red-100 text-red-700" },
];

const findingTone = (status) =>
  FINDING_STATUS.find((s) => s.value === status)?.tone || "bg-gray-100 text-gray-700";

const outcomeMeta = (outcome) => OUTCOMES.find((o) => o.value === outcome);

const emptyReport = { outcome: "PASS", notes: "", findings: [], photos: [] };

// The inspection date must come from the calendar, not free typing — a mistyped
// segment silently books the visit in the wrong year. Keys that move focus or
// dismiss the picker still work.
const DATE_NAV_KEYS = ["Tab", "Escape", "Enter"];

const blockManualDateEntry = (e) => {
  if (!DATE_NAV_KEYS.includes(e.key)) e.preventDefault();
};

// Clicking anywhere on the field opens the native picker. showPicker() throws
// if the browser doesn't support it or the picker is already up, hence the
// guard — the input stays usable either way.
const openDatePicker = (e) => {
  const input = e.currentTarget.querySelector("input");
  try {
    input?.showPicker?.();
  } catch {
    /* picker unavailable or already open */
  }
};

export default function InspectionsPage() {
  const { user } = useAuth();

  const [inspections, setInspections] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
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

  // Report modal — the inspector's on-site write-up (findings + photos + notes).
  // `reportMode` is "complete" for a first submission (PATCH /complete) and
  // "edit" for revising an already-completed report (PUT /:id).
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("complete");
  const [reportData, setReportData] = useState(emptyReport);
  const [uploading, setUploading] = useState(false);

  // Read-only detail view of a submitted report.
  const [viewing, setViewing] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // The inspection the report modal is attached to.
  const [activeInspection, setActiveInspection] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    type: "ROUTINE",
    propertyId: "",
    roomId: "",
    inspector: user?._id || "",
    notes: "",
  });

  // Fetch Properties for the picker. `/properties` paginates at 10 by default,
  // which would silently hide most of the portfolio from the dropdown.
  const fetchDropdownData = async () => {
    try {
      const propRes = await api.get("/properties", { params: { limit: 200 } });
      setProperties(propRes.data.data || propRes.data || []);
    } catch (err) {
      console.error("Failed to load dropdown data:", err);
    }
  };

  // Rooms belong to a property, so the room list is loaded per selection rather
  // than up front — /rooms/property/:id returns them all, unpaginated.
  const fetchRoomsForProperty = async (propertyId) => {
    if (!propertyId) {
      setRooms([]);
      return;
    }
    try {
      setRoomsLoading(true);
      const res = await api.get(`/rooms/property/${propertyId}`);
      setRooms(res.data.data || []);
    } catch (err) {
      console.error("Failed to load rooms:", err);
      setRooms([]);
    } finally {
      setRoomsLoading(false);
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
    fetchRoomsForProperty(inspection.propertyId?._id || "");
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
    setRooms([]);
  };

  // ---------------------------------------------------------------------
  // Inspection report — findings, photos and notes
  // ---------------------------------------------------------------------

  // Opens the report form. "complete" starts from whatever is already on the
  // record (usually blank); "edit" reopens a submitted report for revision.
  const openReportModal = (inspection, mode = "complete") => {
    setActiveInspection(inspection);
    setReportMode(mode);
    setReportData({
      outcome: inspection.outcome || "PASS",
      notes: inspection.notes || "",
      findings: (inspection.findings || []).map((f) => ({
        item: f.item || "",
        status: f.status || "PASS",
        comment: f.comment || "",
      })),
      photos: (inspection.photos || []).map((p) => ({
        url: p.url,
        publicId: p.publicId || "",
        caption: p.caption || "",
      })),
    });
    setViewing(null);
    setShowReportModal(true);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setActiveInspection(null);
    setReportData(emptyReport);
  };

  // Findings list
  const addFinding = () =>
    setReportData((prev) => ({
      ...prev,
      findings: [...prev.findings, { item: "", status: "PASS", comment: "" }],
    }));

  const updateFinding = (index, patch) =>
    setReportData((prev) => ({
      ...prev,
      findings: prev.findings.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));

  const removeFinding = (index) =>
    setReportData((prev) => ({
      ...prev,
      findings: prev.findings.filter((_, i) => i !== index),
    }));

  // Photos — uploaded to Cloudinary first, only the returned URL is persisted.
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const uploaded = [];
    const failed = [];

    for (const file of files) {
      try {
        const { url, publicId } = await uploadToCloudinary(file);
        uploaded.push({ url, publicId, caption: "" });
      } catch (err) {
        failed.push(`${file.name}: ${err.message}`);
      }
    }

    if (uploaded.length) {
      setReportData((prev) => ({ ...prev, photos: [...prev.photos, ...uploaded] }));
    }
    if (failed.length) {
      alert(`Some photos could not be uploaded:\n${failed.join("\n")}`);
    }

    setUploading(false);
    e.target.value = ""; // let the same file be picked again after a failure
  };

  const updatePhotoCaption = (index, caption) =>
    setReportData((prev) => ({
      ...prev,
      photos: prev.photos.map((p, i) => (i === index ? { ...p, caption } : p)),
    }));

  const removePhoto = (index) =>
    setReportData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!activeInspection) return;

    // Blank finding rows are dropped rather than rejected — the inspector may
    // have added a row and changed their mind.
    const payload = {
      outcome: reportData.outcome,
      notes: reportData.notes,
      photos: reportData.photos,
      findings: reportData.findings.filter((f) => f.item.trim()),
    };

    setSubmitting(true);
    try {
      if (reportMode === "edit") {
        await api.put(`/inspections/${activeInspection._id}`, payload);
      } else {
        await api.patch(`/inspections/${activeInspection._id}/complete`, payload);
      }
      closeReportModal();
      fetchInspections();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save inspection report");
    } finally {
      setSubmitting(false);
    }
  };

  // Read-only report view. Re-fetches so the detail (address, full findings)
  // is current rather than whatever the list request happened to return.
  const openViewModal = async (inspection) => {
    setViewing(inspection);
    setViewLoading(true);
    try {
      const res = await api.get(`/inspections/${inspection._id}`);
      setViewing(res.data.data || inspection);
    } catch (err) {
      console.error("Failed to load inspection detail:", err);
    } finally {
      setViewLoading(false);
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
                        <div className="flex flex-col items-start gap-1">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(inspection.status)}`}>
                            {inspection.status.replace("_", " ")}
                          </span>
                          {outcomeMeta(inspection.outcome) && (
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${outcomeMeta(inspection.outcome).tone}`}>
                              {outcomeMeta(inspection.outcome).label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        <p className="truncate">{inspection.notes || "—"}</p>
                        {(inspection.findings?.length > 0 || inspection.photos?.length > 0) && (
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                            {inspection.findings?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <ClipboardCheck size={13} />
                                {inspection.findings.length} finding
                                {inspection.findings.length > 1 ? "s" : ""}
                              </span>
                            )}
                            {inspection.photos?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Camera size={13} />
                                {inspection.photos.length}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-center">
                          {inspection.status !== "COMPLETED" ? (
                            <button
                              onClick={() => openReportModal(inspection, "complete")}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Complete — add findings & photos"
                            >
                              <CheckCircle size={18} />
                            </button>
                          ) : (
                            <button
                              onClick={() => openReportModal(inspection, "edit")}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                              title="Edit report"
                            >
                              <FileText size={18} />
                            </button>
                          )}
                          <button onClick={() => openViewModal(inspection)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="View details">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => openEditModal(inspection)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit schedule">
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

              {/* Date + time is picked from the calendar, never typed in */}
              <div className="relative cursor-pointer" onClick={openDatePicker}>
                <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                  type="datetime-local"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  onKeyDown={blockManualDateEntry}
                  className="w-full border border-gray-300 rounded-2xl pl-12 pr-4 py-3 cursor-pointer focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

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
                onChange={(e) => {
                  // Changing the property invalidates the current room, so clear
                  // it rather than submit a room from a different property.
                  setFormData({ ...formData, propertyId: e.target.value, roomId: "" });
                  fetchRoomsForProperty(e.target.value);
                }}
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
                disabled={!formData.propertyId || roomsLoading}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!formData.propertyId
                    ? "Select a property first"
                    : roomsLoading
                    ? "Loading rooms..."
                    : rooms.length === 0
                    ? "No rooms in this property"
                    : "Select Room (Optional)"}
                </option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {[r.roomNumber, r.roomName, r.title].filter(Boolean).join(" - ")}
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

      {/* Inspection Report Modal — findings, photo evidence and notes */}
      {showReportModal && activeInspection && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between px-8 pt-8 pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold">
                  {reportMode === "edit" ? "Edit Inspection Report" : "Complete Inspection"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {activeInspection.title} ·{" "}
                  {activeInspection.propertyId?.name || "No property"}
                  {activeInspection.roomId?.roomName ? ` · ${activeInspection.roomId.roomName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReportModal}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
              {/* Overall outcome */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Overall Outcome
                </label>
                <div className="flex flex-wrap gap-3">
                  {OUTCOMES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setReportData({ ...reportData, outcome: o.value })}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition ${
                        reportData.outcome === o.value
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Findings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Findings ({reportData.findings.length})
                  </label>
                  <button
                    type="button"
                    onClick={addFinding}
                    className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    <Plus size={16} /> Add finding
                  </button>
                </div>

                {reportData.findings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
                    No findings recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportData.findings.map((finding, index) => (
                      <div key={index} className="rounded-2xl border border-gray-200 p-4 space-y-3">
                        <div className="flex gap-3">
                          <input
                            type="text"
                            placeholder="Item inspected (e.g. Smoke alarm — hallway)"
                            value={finding.item}
                            onChange={(e) => updateFinding(index, { item: e.target.value })}
                            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                          />
                          <select
                            value={finding.status}
                            onChange={(e) => updateFinding(index, { status: e.target.value })}
                            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                          >
                            {FINDING_STATUS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeFinding(index)}
                            className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl"
                            title="Remove finding"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea
                          placeholder="Comment (optional)"
                          value={finding.comment}
                          onChange={(e) => updateFinding(index, { comment: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm h-16 focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Photos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Photos ({reportData.photos.length})
                  </label>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 cursor-pointer">
                    {uploading ? (
                      <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                    ) : (
                      <><ImagePlus size={16} /> Add photos</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      disabled={uploading}
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>

                {reportData.photos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
                    <Camera className="mx-auto mb-2 h-6 w-6 text-gray-400" />
                    No photos attached. Images up to 10MB each.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {reportData.photos.map((photo, index) => (
                      <div key={photo.url + index} className="rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="relative h-28 bg-gray-100">
                          <img src={photo.url} alt={photo.caption || `Photo ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-600 rounded-lg hover:bg-white"
                            title="Remove photo"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Caption"
                          value={photo.caption}
                          onChange={(e) => updatePhotoCaption(index, e.target.value)}
                          className="w-full border-t border-gray-200 px-3 py-2 text-xs outline-none focus:bg-orange-50"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Inspector Notes
                </label>
                <textarea
                  placeholder="Summary of the visit, access issues, follow-up actions..."
                  value={reportData.notes}
                  onChange={(e) => setReportData({ ...reportData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 h-28 focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </form>

            <div className="flex gap-3 px-8 py-6 border-t border-gray-200">
              <button
                type="button"
                onClick={closeReportModal}
                disabled={submitting}
                className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={submitting || uploading}
                className="flex-1 py-3.5 bg-orange-600 text-white rounded-2xl font-medium hover:bg-orange-700 disabled:opacity-70 transition"
              >
                {submitting
                  ? "Saving..."
                  : reportMode === "edit"
                  ? "Save Changes"
                  : "Submit & Complete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-only report view */}
      {viewing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between px-8 pt-8 pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold">{viewing.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(viewing.date).toLocaleString()} · {viewing.type.replace("_", " ")}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
              {/* Summary grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  ["Property", viewing.propertyId?.name || "—"],
                  ["Room", viewing.roomId?.roomName || "—"],
                  ["Inspector", viewing.inspector?.name || viewing.inspector?.email || "—"],
                  ["Status", viewing.status.replace("_", " ")],
                  ["Outcome", outcomeMeta(viewing.outcome)?.label || "—"],
                  [
                    "Completed",
                    viewing.completedAt
                      ? `${new Date(viewing.completedAt).toLocaleDateString()}${
                          viewing.completedBy?.name ? ` by ${viewing.completedBy.name}` : ""
                        }`
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
                    <p className="font-medium text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Findings */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Findings ({viewing.findings?.length || 0})
                </h3>
                {!viewing.findings?.length ? (
                  <p className="text-sm text-gray-500">No findings recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {viewing.findings.map((finding, index) => (
                      <div key={finding._id || index} className="rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-gray-900">{finding.item}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium shrink-0 ${findingTone(finding.status)}`}>
                            {finding.status?.replace("_", " ") || "—"}
                          </span>
                        </div>
                        {finding.comment && (
                          <p className="text-sm text-gray-600 mt-2">{finding.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Photos */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Photos ({viewing.photos?.length || 0})
                </h3>
                {!viewing.photos?.length ? (
                  <p className="text-sm text-gray-500">No photos attached.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {viewing.photos.map((photo, index) => (
                      <a
                        key={photo._id || index}
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl border border-gray-200 overflow-hidden block hover:border-orange-400 transition"
                      >
                        <div className="h-28 bg-gray-100">
                          <img src={photo.url} alt={photo.caption || `Photo ${index + 1}`} className="w-full h-full object-cover" />
                        </div>
                        {photo.caption && (
                          <p className="px-3 py-2 text-xs text-gray-600 truncate">{photo.caption}</p>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Inspector Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {viewing.notes || "No notes recorded."}
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-8 py-6 border-t border-gray-200">
              <button
                onClick={() => setViewing(null)}
                className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                onClick={() =>
                  openReportModal(viewing, viewing.status === "COMPLETED" ? "edit" : "complete")
                }
                disabled={viewLoading}
                className="flex-1 py-3.5 bg-orange-600 text-white rounded-2xl font-medium hover:bg-orange-700 disabled:opacity-70 transition"
              >
                {viewing.status === "COMPLETED" ? "Edit Report" : "Complete Inspection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}