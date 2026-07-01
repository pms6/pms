"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import api from "../api/api";

const ROLES = ["admin", "manager", "agent", "finance", "tenant"];
const STATUSES = ["active", "invited", "disabled"];

const roleBadge = {
  admin: "bg-[#0F253B] text-white",
  manager: "bg-[#F47C3C] text-white",
  agent: "bg-blue-100 text-blue-700",
  finance: "bg-emerald-100 text-emerald-700",
  tenant: "bg-gray-100 text-gray-600",
};
const statusBadge = {
  active: "bg-emerald-100 text-emerald-700",
  invited: "bg-amber-100 text-amber-700",
  disabled: "bg-red-100 text-red-700",
};

function UserModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    password: "",
    role: initial?.role || "manager",
    status: initial?.status || "active",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        const body = { name: form.name, email: form.email, role: form.role, status: form.status };
        if (form.password) body.password = form.password;
        await api.patch(`/users/${initial._id}`, body);
      } else {
        await api.post("/users", form);
      }
      onSaved();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.details?.[0]?.message || d?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Member" : "Add Member"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input className={field} value={form.name} onChange={set("name")} required />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={field} value={form.email} onChange={set("email")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Role</label>
              <select className={field} value={form.role} onChange={set("role")}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={field} value={form.status} onChange={set("status")}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>{isEdit ? "New Password (optional)" : "Password"}</label>
            <input
              type="password"
              className={field}
              value={form.password}
              onChange={set("password")}
              placeholder={isEdit ? "Leave blank to keep current" : "Min 8 characters"}
              required={!isEdit}
              minLength={isEdit ? undefined : 8}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center"
          >
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEdit ? "Save Changes" : "Create Member"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Reusable team (users) management surface — shared by admin & manager. */
export default function TeamManager() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await api.get("/users", { params });
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (u) => {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F253B]">Team</h1>
          <p className="text-sm text-gray-400 font-medium">Manage user accounts and roles</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
        >
          <Plus size={18} /> Add Member
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search name or email…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }}
          className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No team members found</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-bold text-[#0F253B]">{u.name}</td>
                    <td className="px-5 py-3 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${roleBadge[u.role] || "bg-gray-100"}`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${statusBadge[u.status] || "bg-gray-100"}`}>{u.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(u)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg transition-all">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(u)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16} />
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

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium">
            Page {meta.page} of {meta.totalPages} · {meta.total} members
          </p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-gray-100 bg-white disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-gray-100 bg-white disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}

      {modal !== null && (
        <UserModal
          initial={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
