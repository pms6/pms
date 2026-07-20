"use client";

import { useRef, useState } from "react";
import { X, FileSpreadsheet, Download, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import api from "../../../api/api";
import { toOccupancyPayload } from "./AddOccupancyModal";

/* Canonical import columns → also the template header row (in order). */
const COLUMNS = [
  "propertyName", "rentalType", "tenantType", "ownerName", "addressLine1", "city", "postcode",
  "roomName", "roomNumber", "roomType", "occupancy", "monthlyRent", "securityDeposit", "roomStatus",
  "tenant", "tenantEmail", "rent", "startDate", "fixedTermEnd", "periodicStart", "tenancyStatus", "availability",
];

const SAMPLE_ROW = [
  "18 Elm Court", "HMO", "PROFESSIONAL", "Northern Lettings Ltd", "18 Elm Court", "Leeds", "LS2 9JT",
  "Room 4", "4", "STANDARD", "SINGLE", 650, 750, "OCCUPIED",
  "Aisha Patel", "aisha.p@email.com", 650, "2026-07-05", "2027-07-04", "", "Fixed Term", "Occupied",
];

// Normalise a spreadsheet header ("Property Name", "property_name") to a
// canonical key so imports are forgiving about spacing/case.
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const CANON = Object.fromEntries(COLUMNS.map((c) => [norm(c), c]));

// xlsx may hand back Date objects for date cells — coerce to yyyy-mm-dd.
const toYmd = (v) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return v == null ? "" : String(v).trim();
};

export default function ImportExcelModal({ onClose, onImported }) {
  const inputRef = useRef(null);
  const [rows, setRows] = useState([]); // flat mapped rows
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [createAccounts, setCreateAccounts] = useState(false);
  const [result, setResult] = useState(null); // { total, created, failed, errors }

  const invalidRows = rows.filter((r) => !r.propertyName || !r.roomName || !r.tenant).length;

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS, SAMPLE_ROW]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Occupancy");
    XLSX.writeFile(wb, "occupancy-import-template.xlsx");
  };

  const parseFile = async (file) => {
    setParseError("");
    setResult(null);
    setRows([]);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (raw.length === 0) {
        setParseError("The first sheet has no data rows.");
        return;
      }
      // Remap each row's keys to canonical field names.
      const mapped = raw.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          const key = CANON[norm(k)];
          if (key) out[key] = toYmd(v);
        }
        return out;
      });
      setRows(mapped);
    } catch (err) {
      console.error(err);
      setParseError("Could not read that file. Use an .xlsx, .xls or .csv from the template.");
    }
  };

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const runImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const payloadRows = rows
        .filter((r) => r.propertyName && r.roomName && r.tenant)
        .map((r) => toOccupancyPayload(r));
      const res = await api.post("/tenancies/occupancy/bulk", { rows: payloadRows, createAccounts });
      setResult(res.data?.data || null);
      if ((res.data?.data?.created || 0) > 0) onImported?.();
    } catch (err) {
      setParseError(err.response?.data?.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">Import from Excel</h3>
            <p className="text-xs text-gray-400 font-medium">Bulk-add occupancy records from a spreadsheet</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-500">
              Each row creates a <span className="font-bold text-[#0F253B]">Property + Room + Tenancy</span>. Start from the template so the columns match.
            </p>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-[#0F253B] font-bold text-xs rounded-xl"
            >
              <Download size={15} /> Download template
            </button>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-[#F47C3C] bg-orange-50" : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
            }`}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onPick} />
            <UploadCloud size={30} className="mx-auto text-[#F47C3C]" />
            <p className="mt-2 text-sm font-bold text-[#0F253B]">
              {fileName ? fileName : "Drop your Excel file here, or click to browse"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">.xlsx, .xls or .csv</p>
          </div>

          {parseError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertTriangle size={16} /> {parseError}
            </div>
          )}

          {/* Result summary */}
          {result && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0F253B]">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Imported {result.created} of {result.total} row(s).
                {result.failed > 0 && <span className="text-red-600">{result.failed} failed.</span>}
              </div>
              {result.errors?.length > 0 && (
                <ul className="text-xs text-red-600 list-disc pl-5 max-h-28 overflow-y-auto">
                  {result.errors.map((e) => (
                    <li key={e.row}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                  <FileSpreadsheet size={14} /> Preview — {rows.length} row(s)
                </p>
                {invalidRows > 0 && (
                  <p className="text-xs font-bold text-amber-600">
                    {invalidRows} row(s) missing property/room/tenant will be skipped
                  </p>
                )}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-gray-400 font-bold">
                      <th className="px-3 py-2">Property</th>
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Tenant</th>
                      <th className="px-3 py-2 text-right">Rent</th>
                      <th className="px-3 py-2">Start</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const bad = !r.propertyName || !r.roomName || !r.tenant;
                      return (
                        <tr key={i} className={`border-t border-gray-50 ${bad ? "bg-red-50/50" : ""}`}>
                          <td className="px-3 py-2 font-medium text-[#0F253B]">{r.propertyName || <span className="text-red-500">—</span>}</td>
                          <td className="px-3 py-2">{r.roomName || <span className="text-red-500">—</span>}</td>
                          <td className="px-3 py-2">{r.tenant || <span className="text-red-500">—</span>}</td>
                          <td className="px-3 py-2 text-right">{r.rent || r.monthlyRent || "—"}</td>
                          <td className="px-3 py-2">{r.startDate || "—"}</td>
                          <td className="px-3 py-2">{r.tenancyStatus || "Fixed Term"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Account creation option */}
          {rows.length > 0 && !result && (
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                createAccounts ? "border-[#F47C3C] bg-orange-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={createAccounts}
                onChange={(e) => setCreateAccounts(e.target.checked)}
                className="mt-0.5 accent-[#F47C3C]"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#0F253B]">
                  <Mail size={14} /> Create tenant accounts &amp; email login details
                </span>
                <span className="block text-[11px] text-gray-500 mt-0.5">
                  For every row with a tenant email, create a portal account (if new) and email their temporary password. Leave off to import records only.
                </span>
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-[#0F253B]">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={runImport}
              disabled={importing || rows.length === 0 || rows.length - invalidRows === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {importing ? "Importing…" : `Import ${Math.max(rows.length - invalidRows, 0)} row(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
