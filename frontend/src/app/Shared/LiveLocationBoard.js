"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, RefreshCw, Radio, Clock3, ExternalLink } from "lucide-react";
import { PageHeader } from "./ui";
import { nameFromEmail } from "./creator";
import api from "../api/api";

// The board polls rather than holding a socket open: an agent pings every five
// minutes, so anything faster than this would mostly re-fetch the same fixes.
const REFRESH_MS = 60 * 1000;

const mapsLink = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// An embedded map with no API key. Fine for a pin; it is not an interactive map.
const embedSrc = (lat, lng) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;

function ago(ms) {
  if (ms === null || ms === undefined) return "no fix yet";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
}

/**
 * Where the organization's agents are, for every staff seat that is not the
 * agent themselves.
 *
 * Only agents with sharing switched ON appear. An agent who switches off
 * vanishes from this list entirely — there is no "last known position" left
 * behind, because the server clears it.
 */
export default function LiveLocationBoard({
  title = "Live Location",
  subtitle = "Agents currently sharing their position",
}) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.get("/agent-location");
      const data = res.data?.data || [];
      setLocations(data);
      setRefreshedAt(new Date());
      setError("");
      // Keep the open map on the same agent across refreshes; drop it if they
      // have stopped sharing.
      setSelected((cur) =>
        cur && data.some((l) => String(l.userId) === String(cur)) ? cur : null
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load agent locations");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load({ quiet: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const withFix = locations.filter((l) => l.hasFix);
  const shown = withFix.find((l) => String(l.userId) === String(selected)) || withFix[0] || null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            onClick={() => load()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl">
          <MapPin size={30} className="mx-auto text-gray-200 mb-3" />
          <p className="font-bold text-[#0F253B]">No agent is sharing right now</p>
          <p className="text-sm text-gray-400 font-medium mt-1">
            An agent appears here as soon as they switch their live location on.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Who is sharing */}
          <div className="space-y-3">
            {locations.map((l) => {
              const isSelected = shown && String(shown.userId) === String(l.userId);

              return (
                <button
                  key={l.userId}
                  onClick={() => l.hasFix && setSelected(l.userId)}
                  disabled={!l.hasFix}
                  className={`w-full text-left bg-white border rounded-2xl p-4 transition-all ${
                    isSelected
                      ? "border-[#F47C3C] ring-2 ring-[#F47C3C]/20"
                      : "border-gray-100 hover:shadow-md"
                  } ${l.hasFix ? "cursor-pointer" : "cursor-default opacity-70"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {(nameFromEmail(l.email) || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0F253B] text-sm truncate">
                        {nameFromEmail(l.email) || "Agent"}
                      </p>
                      <p className="text-[11px] text-gray-400 font-medium truncate" title={l.email}>
                        {l.email}
                      </p>
                    </div>

                    {/* Live vs stale: an hour-old fix is not where they are now. */}
                    <span
                      className={`flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 ${
                        l.stale
                          ? "text-amber-700 bg-amber-50"
                          : "text-emerald-700 bg-emerald-50"
                      }`}
                    >
                      {l.stale ? <Clock3 size={10} /> : <Radio size={10} className="animate-pulse" />}
                      {l.stale ? "Stale" : "Live"}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 font-medium mt-2.5">
                    {l.hasFix ? (
                      <>
                        {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
                        {l.accuracy ? ` · ±${Math.round(l.accuracy)}m` : ""}
                      </>
                    ) : (
                      "Sharing on — waiting for a position"
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 font-medium">{ago(l.ageMs)}</p>
                </button>
              );
            })}

            {refreshedAt && (
              <p className="text-[11px] text-gray-300 font-medium text-center pt-1">
                Updated {refreshedAt.toLocaleTimeString()} · refreshes every minute
              </p>
            )}
          </div>

          {/* Map for whoever is selected */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {shown ? (
              <>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                  <div className="min-w-0">
                    <p className="font-bold text-[#0F253B] text-sm truncate">
                      {nameFromEmail(shown.email) || "Agent"}
                    </p>
                    <p className="text-[11px] text-gray-400 font-medium">{ago(shown.ageMs)}</p>
                  </div>
                  <a
                    href={mapsLink(shown.lat, shown.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline shrink-0"
                  >
                    Open in Maps <ExternalLink size={13} />
                  </a>
                </div>
                <iframe
                  key={`${shown.userId}-${shown.lat}-${shown.lng}`}
                  title={`Location of ${shown.email}`}
                  src={embedSrc(shown.lat, shown.lng)}
                  className="w-full h-[460px] border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </>
            ) : (
              <div className="h-[460px] flex flex-col items-center justify-center text-center px-6">
                <MapPin size={28} className="text-gray-200 mb-3" />
                <p className="font-bold text-[#0F253B] text-sm">No position yet</p>
                <p className="text-sm text-gray-400 font-medium mt-1">
                  Sharing is on, but no fix has come through from the agent&apos;s device.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
