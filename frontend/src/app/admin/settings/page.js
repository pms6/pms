"use client";

import { useEffect, useState } from "react";
import { Save, CreditCard, Monitor, Trash2, ShieldOff } from "lucide-react";
import api from "../../api/api";

/** Best-effort friendly device label from a raw user-agent string. */
function deviceLabel(ua) {
  if (!ua) return "Unknown device";
  const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

function SessionsPanel() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/auth/sessions");
      setSessions(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Revoke failed");
    }
  };

  const revokeOthers = async () => {
    if (!confirm("Sign out of all other devices?")) return;
    try {
      await api.post("/auth/logout-all");
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed");
    }
  };

  const hasOthers = sessions.some((s) => !s.current);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Security</p>
          <h2 className="text-lg font-bold text-[#0F253B]">Active Sessions</h2>
        </div>
        {hasOthers && (
          <button
            onClick={revokeOthers}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <ShieldOff size={15} /> Sign out other devices
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C]">
                  <Monitor size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0F253B] truncate">
                    {deviceLabel(s.userAgent)}
                    {s.current && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">This device</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {s.ip || "—"} · last used {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : "—"}
                  </p>
                </div>
              </div>
              {!s.current && (
                <button
                  onClick={() => revoke(s.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                  title="Revoke session"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const [account, setAccount] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [form, setForm] = useState({ name: "", type: "landlord", contactEmail: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/accounts/me");
        if (!active) return;
        const { account, subscription } = res.data.data;
        setAccount(account);
        setSubscription(subscription);
        setForm({
          name: account.name || "",
          type: account.type || "landlord",
          contactEmail: account.contactEmail || "",
        });
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load account");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.patch("/accounts/me", form);
      setAccount(res.data.data.account);
      setSuccess("Account updated");
    } catch (err) {
      const d = err.response?.data;
      setError(d?.details?.[0]?.message || d?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" />
      </div>
    );
  }

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0F253B]">Account Settings</h1>
        <p className="text-sm text-gray-400 font-medium">Manage your organisation profile and plan</p>
      </div>

      {/* Subscription card */}
      {subscription && (
        <div className="rounded-2xl bg-[#0F253B] text-white p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Current Plan</p>
            <p className="text-lg font-bold capitalize mt-1">
              {subscription.plan}
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/15 capitalize">
                {subscription.status}
              </span>
            </p>
            {subscription.renewalDate && (
              <p className="text-xs text-white/60 mt-1">
                Renews {new Date(subscription.renewalDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <CreditCard size={28} className="text-[#F47C3C]" />
        </div>
      )}

      {/* Account form */}
      <form onSubmit={save} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
        {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        {success && <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-bold rounded">{success}</div>}

        <div>
          <label className={labelCls}>Account Name</label>
          <input className={field} value={form.name} onChange={set("name")} required />
        </div>
        <div>
          <label className={labelCls}>Account Type</label>
          <select className={field} value={form.type} onChange={set("type")}>
            <option value="landlord">Landlord</option>
            <option value="agency">Agency</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Contact Email</label>
          <input type="email" className={field} value={form.contactEmail} onChange={set("contactEmail")} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
          Save Changes
        </button>
      </form>

      <SessionsPanel />
    </div>
  );
}
