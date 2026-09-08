"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, UserRound, Wifi, WifiOff } from "lucide-react";
import api from "@/app/api/api";

/* ---------------------------------------------------------------------------
 * Who on the team is at their desk right now.
 *
 * Unlike screen monitoring, this needs nothing from the staff member: their
 * browser checks in on its own while a portal is open, so somebody shows up
 * here the moment they log in. Owner and admin only — the API refuses the rest.
 * ------------------------------------------------------------------------- */

// The list is only meaningful while it is fresh, so it refreshes itself. Longer
// than the 60s heartbeat so a beat always lands between two refreshes.
const REFRESH_MS = 30 * 1000;

const ROLE_LABEL = {
  OWNER: "Owner", ADMIN: "Admin", MANAGER: "Manager", AGENT: "Agent", FINANCE: "Finance",
  OPERATION: "Operation",
};

const PORTAL_LABEL = {
  admin: "Admin portal", manager: "Manager portal", agent: "Agent portal", finance: "Finance portal",
  operation: "Operation portal",
};

const ago = (d) => {
  if (!d) return "never";
  const mins = Math.floor((Date.now() - new Date(d)) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const forDuration = (from) => {
  if (!from) return "";
  const mins = Math.floor((Date.now() - new Date(from)) / 60000);
  if (mins < 1) return "just arrived";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function OnlineStaffPanel() {
  const [rows, setRows] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/presence");
      setRows(res.data.data || []);
      setOnlineCount(res.data.onlineCount || 0);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load who is online.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
          <Wifi size={15} className="text-emerald-500" />
          Online now
          <span className="text-xs font-bold text-gray-400">
            {loading ? "" : `${onlineCount} of ${rows.length}`}
          </span>
        </p>
        <p className="text-[11px] font-medium text-gray-400">Refreshes every 30s</p>
      </div>

      {error ? (
        <div className="px-5 py-4 text-sm font-medium text-red-600">{error}</div>
      ) : loading ? (
        <div className="px-5 py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin inline text-[#F47C3C]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400 font-medium">
          No team members yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-50">
          {rows.map((r) => (
            <div key={r.userId} className="bg-white px-4 py-3 flex items-center gap-3">
              <span className="relative shrink-0">
                <span className="w-9 h-9 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                  <UserRound size={17} />
                </span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    r.online ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0F253B] truncate">{r.email}</p>
                <p className="text-[11px] font-medium text-gray-400 truncate">
                  {ROLE_LABEL[r.role] || r.role}
                  {r.memberStatus !== "ACTIVE" ? ` · ${r.memberStatus.toLowerCase()}` : ""}
                </p>
              </div>

              <div className="text-right shrink-0">
                {r.online ? (
                  <>
                    <p className="text-[11px] font-bold text-emerald-600">Online</p>
                    <p className="text-[10px] font-medium text-gray-400">
                      {PORTAL_LABEL[r.portal] || "—"}
                    </p>
                    {r.sessionStartedAt && (
                      <p className="text-[10px] font-medium text-gray-300">{forDuration(r.sessionStartedAt)}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 justify-end">
                      <WifiOff size={11} /> Offline
                    </p>
                    <p className="text-[10px] font-medium text-gray-300">{ago(r.lastSeenAt)}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
