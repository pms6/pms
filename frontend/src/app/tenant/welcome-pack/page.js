"use client";

import React, { useState } from "react";
import {
  Phone,
  Wifi,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

export default function WelcomePage() {
  const [expanded, setExpanded] = useState(false);

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

      <div className="space-y-4 sm:space-y-5">

        {/* CONTACT CARD */}
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
                07123 456789
              </p>
            </div>
          </div>

          <button className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition">
            Call
          </button>
        </div>

        {/* WIFI CARD */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Wifi className="text-blue-500" size={20} />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                WiFi Key
              </p>
              <p className="font-mono font-semibold text-slate-800 text-sm sm:text-base break-all">
                WIFIharv76y237y6
              </p>
            </div>
          </div>

          <button className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition">
            Copy
          </button>
        </div>

        {/* GUIDE CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

          {/* HEADER */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Defrosting Your Freezer
              </h2>
              <p className="text-sm text-slate-500">
                Maintenance guide for Hotpoint
              </p>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 text-sm font-semibold rounded-xl hover:bg-orange-100 transition"
            >
              {expanded ? (
                <>
                  <ChevronUp size={18} /> Hide
                </>
              ) : (
                <>
                  <ChevronDown size={18} /> View Guide
                </>
              )}
            </button>
          </div>

          {/* EXPANDED CONTENT */}
          {expanded && (
            <div className="px-4 sm:px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">

              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-900">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/8FUouFhF5Dg"
                  title="How to defrost your fridge freezer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                To keep your freezer efficient, defrost when ice reaches 3–5mm thick.
                Always turn off power first and never use sharp tools to avoid damage.
              </p>

              <a
                href="https://youtu.be/8FUouFhF5Dg"
                target="_blank"
                className="inline-flex items-center gap-2 text-blue-600 font-medium hover:underline text-sm"
              >
                Watch on YouTube <ExternalLink size={14} />
              </a>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}