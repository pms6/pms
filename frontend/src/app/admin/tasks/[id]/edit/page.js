"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "../../../../Shared/ui";
import api from "../../../../api/api";
import TaskForm from "../../../_components/TaskForm";

export default function AdminEditTask() {
  const router = useRouter();
  const { id } = useParams();

  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The task and the team are both needed before the form can render — it
  // opens with the assignees already ticked, which needs both.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, membersRes] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get("/tasks/assignable-members"),
      ]);
      setTask(taskRes.data?.data || null);
      setMembers(membersRes.data?.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load that task.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload) => {
    await api.put(`/tasks/${id}`, payload);
    router.push("/admin/tasks");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Edit Task"
        subtitle={task?.title || "Change the work, who is doing it, or when it is due"}
        action={
          <Link
            href="/admin/tasks"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl"
          >
            <ArrowLeft size={16} /> Back to tasks
          </Link>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-10 text-center text-gray-400">
          Loading the task…
        </div>
      ) : task ? (
        <TaskForm
          members={members}
          initial={task}
          onCancel={() => router.push("/admin/tasks")}
          onSave={save}
        />
      ) : (
        !error && (
          <div className="bg-white border border-gray-100 rounded-2xl px-5 py-10 text-center text-gray-400">
            That task no longer exists.
          </div>
        )
      )}
    </div>
  );
}
