"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  FileText,
  Eye,
  Download,
  X,
} from "lucide-react";

const DOCUMENTS = [
  {
    id: 1,
    title: "Gas Safety Certificate",
    description:
      "Valid July 11, 2025 to July 12, 2026 (Acknowledgement not applicable)",
    file: "/sample.pdf",
  },
  {
    id: 2,
    title: "Energy Performance Certificate (EPC)",
    description:
      "Valid November 5, 2024 to November 6, 2034 (Acknowledgement not applicable)",
    file: "/sample.pdf",
  },
  {
    id: 3,
    title: "Electrical Installation Condition Report (EICR)",
    description:
      "Valid December 6, 2023 to December 5, 2028 (Acknowledgement not applicable)",
    file: "/sample.pdf",
  },
  {
    id: 4,
    title: "Deposit Management",
    description:
      "Deposit protection scheme (MyDeposits) deposit of £675. Completed on February 14, 2026.",
    file: "/sample.pdf",
  },
];

export default function CompliancePage() {
  const [selected, setSelected] = useState(null);

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

      {/* List */}
      <div className="space-y-4 sm:space-y-5">
        {DOCUMENTS.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5"
          >
            {/* Left */}
            <div className="flex gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="text-[#F47C3C]" size={24} />
              </div>

              <div>
                <h2 className="font-bold text-base sm:text-lg text-[#0F253B]">
                  {doc.title}
                </h2>

                <p className="text-gray-500 text-xs sm:text-sm mt-1 leading-relaxed">
                  {doc.description}
                </p>

                <div className="flex items-center gap-2 mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500">
                  <FileText size={14} />
                  PDF Document
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={() => setSelected(doc)}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#F47C3C] text-[#F47C3C] hover:bg-orange-50 w-full sm:w-auto"
              >
                <Eye size={16} />
                View
              </button>

              <a
                href={doc.file}
                download
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#F47C3C] text-white hover:bg-[#e36f31] w-full sm:w-auto"
              >
                <Download size={16} />
                Download
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="bg-white w-full sm:max-w-5xl h-[92vh] sm:h-[90vh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-3xl">

            {/* Header */}
            <div className="border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h2 className="text-base sm:text-xl font-bold text-[#0F253B] truncate pr-4">
                {selected.title}
              </h2>

              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* PDF */}
            <div className="flex-1 bg-gray-100">
              <iframe
                src={selected.file}
                title={selected.title}
                className="w-full h-full"
              />
            </div>

            {/* Footer */}
            <div className="border-t px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
              <a
                href={selected.file}
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