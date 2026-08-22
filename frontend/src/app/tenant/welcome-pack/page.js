"use client";

import React, { useEffect, useState } from "react";
import {
  Phone,
  Wifi,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Check,
  CalendarClock,
} from "lucide-react";
import api from "@/app/api/api";

const DAY_MS = 86400000;

// How much longer this card stays in the pack. The server only sends cards
// whose window covers today, so this is never negative — it exists to tell the
// tenant a guide is temporary before it quietly disappears.
//
// Both dates are compared at midnight so "expires today" reads as 0 days left
// rather than a fraction of one.
const daysLeft = (until) => {
  if (!until) return null;
  const end = new Date(until);
  if (Number.isNaN(end.getTime())) return null;
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today) / DAY_MS);
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

// Turn a YouTube watch/short URL into an embeddable one; pass others through.
const toEmbed = (url) => {
  if (!url) return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
};

export default function WelcomePage() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/welcome-pack/my");
        if (active) setPacks(res.data?.data || []);
      } catch (err) {
        if (active)
          setError(
            err?.response?.data?.message || "Failed to load your welcome pack."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Contact + WiFi are property-level; take them from the first pack that has them.
  const phone = packs.find((p) => p.emergencyNumber)?.emergencyNumber || "";
  const wifiPack = packs.find((p) => p.wifiPassword || p.wifiNetwork);

  const copyWifi = async () => {
    if (!wifiPack?.wifiPassword) return;
    try {
      await navigator.clipboard.writeText(wifiPack.wifiPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-0.5 sm:px-6 py-6 sm:py-8 bg-gray-50 min-h-screen font-sans">

      {/* HEADER */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Welcome Pack
        </h1>
        <p className="text-slate-500 mt-1 sm:mt-2 text-sm sm:text-base">
          Essential information for your stay
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-500">
          Loading your welcome pack…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : packs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
            <FileText className="text-orange-500" size={24} />
          </div>
          <p className="text-slate-600 font-medium">No welcome pack yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Guides and property info your operator shares will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">

          {/* CONTACT CARD */}
          {phone && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Phone className="text-orange-500" size={20} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Property Manager
                  </p>
                  <p className="font-semibold text-slate-800 text-sm sm:text-base">
                    {phone}
                  </p>
                </div>
              </div>
              <a
                href={`tel:${phone}`}
                className="w-full sm:w-auto text-center px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition"
              >
                Call
              </a>
            </div>
          )}

          {/* WIFI CARD */}
          {wifiPack && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Wifi className="text-blue-500" size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {wifiPack.wifiNetwork ? `WiFi · ${wifiPack.wifiNetwork}` : "WiFi Key"}
                  </p>
                  <p className="font-mono font-semibold text-slate-800 text-sm sm:text-base break-all">
                    {wifiPack.wifiPassword || "—"}
                  </p>
                </div>
              </div>
              {wifiPack.wifiPassword && (
                <button
                  onClick={copyWifi}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-2"
                >
                  {copied ? <><Check size={16} className="text-green-600" /> Copied</> : "Copy"}
                </button>
              )}
            </div>
          )}

          {/* GUIDE CARDS — one per welcome pack */}
          {packs.map((pack) => {
            const expanded = expandedId === pack._id;
            const embed = toEmbed(pack.videoUrl);
            return (
              <div
                key={pack._id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
              >
                {/* HEADER */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      {pack.title}
                    </h2>
                    {pack.propertyId?.name && (
                      <p className="text-sm text-slate-500">
                        {pack.propertyId.name}
                        {(pack.roomId?.roomName || pack.roomId?.title) && (
                          <span className="text-indigo-600 font-medium">
                            {" · "}{pack.roomId.roomName || pack.roomId.title}
                          </span>
                        )}
                      </p>
                    )}
                    {(() => {
                      const left = daysLeft(pack.visibleUntil);
                      if (left === null) return null;
                      const urgent = left <= 7;
                      return (
                        <span
                          className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            urgent
                              ? "text-amber-700 bg-amber-50"
                              : "text-slate-500 bg-slate-100"
                          }`}
                        >
                          <CalendarClock size={11} />
                          {left === 0
                            ? "Available until today"
                            : left === 1
                            ? "Available until tomorrow"
                            : `Available until ${fmtDate(pack.visibleUntil)} · ${left} days left`}
                        </span>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setExpandedId(expanded ? null : pack._id)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 text-sm font-semibold rounded-xl hover:bg-orange-100 transition"
                  >
                    {expanded ? (
                      <><ChevronUp size={18} /> Hide</>
                    ) : (
                      <><ChevronDown size={18} /> View Guide</>
                    )}
                  </button>
                </div>

                {/* EXPANDED CONTENT */}
                {expanded && (
                  <div className="px-4 sm:px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">
                    {embed && (
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-900">
                        <iframe
                          className="w-full h-full"
                          src={embed}
                          title={pack.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {pack.description && (
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                        {pack.description}
                      </p>
                    )}

                    {pack.videoUrl && (
                      <a
                        href={pack.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 font-medium hover:underline text-sm"
                      >
                        Watch video <ExternalLink size={14} />
                      </a>
                    )}

                    {pack.documentUrl && (
                      <a
                        href={pack.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-orange-600 font-medium hover:underline text-sm"
                      >
                        <FileText size={14} /> {pack.documentName || "Open document"}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
