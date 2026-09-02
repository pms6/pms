"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "../../../Shared/ui";
import api from "../../../api/api";
import TaskForm from "../../_components/TaskForm";

export default function AdminNewTask() {
  const router = useRouter();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The form cannot be submitted without at least one assignee, so the member
  // list is loaded before it renders rather than alongside it.
  const load = useCallback(async () => {
    try {
      const res = await api.get("/tasks/assignable-members");
      setMembers(res.data?.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload) => {
    await api.post("/tasks", payload);
    // Back to the board, which reloads and shows the new task.
    router.push("/admin/tasks");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create & Assign Task"
        subtitle="Give the work a title, a description, the people doing it and a deadline"
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
          Loading the team…
        </div>
      ) : (
        <TaskForm
          members={members}
          onCancel={() => router.push("/admin/tasks")}
          onSave={save}
        />
      )}
    </div>
  );
}
