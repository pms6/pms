"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  FileText,
  Eye,
  Download,
  X,
} from "lucide-react";
import api from "@/app/api/api";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

// Human-readable description for a compliance record.
const describe = (doc) => {
  const from = fmtDate(doc.carriedOut);
  const to = fmtDate(doc.expiryDate);
  if (from && to) return `Valid ${from} to ${to}`;
  if (to) return `Valid until ${to}`;
  return doc.subType || "Compliance certificate";
};

const STATUS_STYLES = {
  valid: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  expired: "bg-red-50 text-red-700 border-red-200",
};

export default function CompliancePage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/compliance/my");
        if (active) setDocs(res.data?.data || []);
      } catch (err) {
        if (active)
          setError(
            err?.response?.data?.message || "Failed to load compliance documents."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-0.5 sm:px-6 lg:px-0 space-y-6 sm:space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F253B]">
          Property Compliance
        </h1>

        <p className="text-gray-500 mt-2 text-sm sm:text-base">
          View and download compliance documents for your property.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">
          Loading compliance documents…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
            <ShieldCheck className="text-[#F47C3C]" size={24} />
          </div>
          <p className="text-gray-600 font-medium">No compliance documents yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Certificates your operator uploads for your property will appear here.
          </p>
        </div>
      ) : (
        /* List */
        <div className="space-y-4 sm:space-y-5">
          {docs.map((doc) => {
            const title = [doc.type, doc.subType].filter(Boolean).join(" — ");
            const hasFile = !!doc.fileUrl;
            return (
              <div
                key={doc._id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5"
              >
                {/* Left */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="text-[#F47C3C]" size={24} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-base sm:text-lg text-[#0F253B]">
                        {title || "Compliance Certificate"}
                      </h2>
                      {doc.status && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize ${
                            STATUS_STYLES[doc.status] || "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {doc.status}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-500 text-xs sm:text-sm mt-1 leading-relaxed">
                      {describe(doc)}
                    </p>

                    <div className="flex items-center gap-2 mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500">
                      <FileText size={14} />
                      {doc.fileName || (hasFile ? "Document" : "No file attached")}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {hasFile && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setSelected(doc)}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#F47C3C] text-[#F47C3C] hover:bg-orange-50 w-full sm:w-auto"
                    >
                      <Eye size={16} />
                      View
                    </button>

                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#F47C3C] text-white hover:bg-[#e36f31] w-full sm:w-auto"
                    >
                      <Download size={16} />
                      Download
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="bg-white w-full sm:max-w-5xl h-[92vh] sm:h-[90vh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-3xl">

            {/* Header */}
            <div className="border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h2 className="text-base sm:text-xl font-bold text-[#0F253B] truncate pr-4">
                {[selected.type, selected.subType].filter(Boolean).join(" — ") || "Compliance Certificate"}
              </h2>

              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* PDF. <object> rather than <iframe> so a certificate the host
                refuses to serve, or one that is no longer there, shows the
                fallback below instead of an unexplained blank panel. */}
            <div className="flex-1 bg-gray-100">
              <object
                data={selected.fileUrl}
                type="application/pdf"
                title={selected.type || "Compliance"}
                className="w-full h-full"
              >
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-sm font-bold text-[#0F253B]">
                    This certificate could not be displayed.
                  </p>
                  <p className="text-xs font-medium text-gray-500">
                    Try the download button below, or ask your property manager to re-upload it.
                  </p>
                </div>
              </object>
            </div>

            {/* Footer */}
            <div className="border-t px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
              <a
                href={selected.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#F47C3C] text-white hover:bg-[#e36f31] w-full sm:w-auto"
              >
                <Download size={18} />
                Download
              </a>

              <button
                onClick={() => setSelected(null)}
                className="px-5 py-3 rounded-xl border hover:bg-gray-50 w-full sm:w-auto"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
