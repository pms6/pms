"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Calendar,
  X,
  Loader2,
  CheckCircle,
  User,
  Activity,
  CheckSquare,
  FileText,
  Clock,
} from "lucide-react";
import { useAuth } from "@/app/Context/AuthContext";
import api from "@/app/api/api";

export default function AuditLogPage() {
  const { user } = useAuth();
  const organizationId = user?.organizationId || user?.profile?._id || user?._id;

  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  // Modal States
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // Form States
  const [newNote, setNewNote] = useState({ title: "", description: "" });
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignedTo: "",
  });

  // Fetch Tasks + Logs
  const fetchData = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data } = await api.get(`/audit/${organizationId}/tasks-logs`);
      setTasks(data.tasks || []);
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch audit data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Members for Task Assignment
  const fetchMembers = async () => {
    if (!organizationId) return;
    setMembersLoading(true);
    try {
      const { data } = await api.get(`/audit/${organizationId}/members`);
      setMembers(data.members || []);
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchData();
      fetchMembers();
    }
  }, [organizationId]);

  // Add Manual Note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.title.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/audit/${organizationId}/notes`, newNote);
      setNewNote({ title: "", description: "" });
      setShowAddNoteModal(false);
      fetchData();
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Create New Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.dueDate || !newTask.assignedTo) return;

    setSubmitting(true);
    try {
      await api.post(`/audit/${organizationId}/tasks`, newTask);
      setNewTask({ title: "", description: "", dueDate: "", assignedTo: "" });
      setShowAddTaskModal(false);
      fetchData();
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Mark Task as Complete
  const handleCompleteTask = async (taskId) => {
    try {
      await api.patch(`/audit/tasks/${taskId}/complete`);
      fetchData();
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <ClipboardList className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Audit Log & Tasks</h1>
              <p className="text-slate-500 mt-1 text-sm md:text-base">Track organization activities and manage assigned actions seamlessly.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAddNoteModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 hover:border-slate-300 font-semibold text-sm transition-all shadow-sm"
            >
              <Plus size={18} className="text-slate-500" /> Add Note
            </button>
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-semibold text-sm transition-all shadow-md shadow-blue-600/20"
            >
              <Plus size={18} /> New Task
            </button>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <CheckSquare className="h-5 w-5 text-blue-600" /> Assigned Tasks 
              <span className="ml-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                {tasks.length}
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-16 bg-white rounded-3xl border border-slate-100">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-16 text-center space-y-3">
              <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                <CheckSquare className="h-8 w-8" />
              </div>
              <p className="text-slate-500 font-medium">No tasks assigned yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <div
                  key={task._id}
                  className={`bg-white border rounded-2xl p-6 flex items-start md:items-center gap-4 transition-all ${
                    task.status === "COMPLETED" 
                      ? "border-slate-100 bg-slate-50/40 opacity-75" 
                      : "border-slate-200/80 hover:border-blue-200 hover:shadow-md hover:shadow-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.status === "COMPLETED"}
                    onChange={() => task.status !== "COMPLETED" && handleCompleteTask(task._id)}
                    className="mt-1 md:mt-0 w-5 h-5 accent-blue-600 cursor-pointer rounded-md"
                    disabled={task.status === "COMPLETED"}
                  />

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className={`font-semibold text-base md:text-lg text-slate-900 ${task.status === "COMPLETED" ? "line-through text-slate-400" : ""}`}>
                        {task.title}
                      </h3>
                      {task.status === "COMPLETED" && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 w-fit">
                          <CheckCircle size={14} /> Completed
                        </span>
                      )}
                    </div>

                    {task.description && <p className="text-slate-600 text-sm">{task.description}</p>}

                    <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-2 text-xs md:text-sm text-slate-500">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <Calendar size={14} className="text-slate-400" />
                        <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <User size={14} className="text-slate-400" />
                        <span>Assigned to: <strong className="text-slate-700">{task.assignedTo?.userId?.name || "Unknown"}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Logs Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-indigo-600" /> Activity History
          </h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8 divide-y divide-slate-100">
            {logs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-medium">No activity logs found.</div>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="flex gap-5 py-6 first:pt-0 last:pb-0">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50/70 border border-indigo-100/50 flex items-center justify-center flex-shrink-0 text-indigo-600">
                    <FileText size={20} />
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/60">
                      {log.category}
                    </span>
                    <h4 className="font-semibold text-slate-900 text-base">{log.title}</h4>
                    {log.description && <p className="text-slate-600 text-sm leading-relaxed">{log.description}</p>}
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                      <Clock size={12} />
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>By <strong className="text-indigo-600 font-medium">{log.userId?.name || "System"}</strong></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Add Organisation Note</h2>
              <button 
                onClick={() => setShowAddNoteModal(false)}
                className="h-8 w-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Note Title</label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="e.g., Policy Update Review"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={newNote.description}
                  onChange={(e) => setNewNote({ ...newNote, description: e.target.value })}
                  placeholder="Add details about this note (optional)..."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 h-32 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddNoteModal(false)} 
                  className="flex-1 py-3.5 rounded-2xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-70 flex items-center justify-center gap-2 transition text-sm shadow-lg shadow-blue-600/20"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Create New Task</h2>
              <button 
                onClick={() => setShowAddTaskModal(false)}
                className="h-8 w-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Task Title</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g., Complete Security Audit"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Task instructions..."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 h-24 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Assign To</label>
                <select
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm bg-white"
                  required
                  disabled={membersLoading}
                >
                  <option value="">Select Member</option>
                  {members.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.userId?.name} ({member.userId?.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="flex-1 py-3.5 rounded-2xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-70 flex items-center justify-center gap-2 transition text-sm shadow-lg shadow-blue-600/20"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}