"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Bed,
  Building2,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import api from "@/app/api/api";
import {
  CSV_COLUMNS,
  COLUMN_HELP,
  canonicalizeRow,
  rowsToProperties,
  unknownHeaders,
} from "@/app/utils/propertyCsv";

// ---------------------------------------------------------------------------
// Bulk property import for the public "list your property" page.
//
// One row per room; rows sharing a propertyRef become one property with several
// rooms (see utils/propertyCsv.js for the full contract). The file is parsed
// and previewed in the browser, then sent one property per request so the
// progress screen can name the property being saved and the files being copied
// into Cloudinary for it.
// ---------------------------------------------------------------------------

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL =
  "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

// Properties are sent ONE PER REQUEST rather than in batches. Each one has its
// photos and documents copied into Cloudinary server-side before it is saved,
// which takes a few seconds, so sending them singly is what lets the progress
// screen say which property is being worked on instead of freezing on a batch.
const fileCountOf = (entry) =>
  (entry.property.coverImage ? 1 : 0) +
  entry.property.gallery.length +
  entry.property.documents.length +
  entry.rooms.reduce((total, room) => total + room.images.length, 0);

// One sample covering every case: all four rental types, a property with
// several rooms, a property let as a whole, and both ways of laying out the
// rows of a multi-room property.
const SAMPLE_PATH = "/samples/property-import-sample.csv";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function PropertyCsvImport({ slug, organization }) {
  const inputRef = useRef(null);

  const [submitter, setSubmitter] = useState({
    role: "AGENT",
    name: "",
    company: "",
    email: "",
    phone: "",
  });

  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState(null); // { properties, errors, warnings }
  const [error, setError] = useState("");

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { total, created, failed, results }

  // Live progress: one status per parsed property, plus running totals.
  const [rowState, setRowState] = useState([]); // "pending" | "saving" | "done" | "failed"
  const [tally, setTally] = useState({ saved: 0, rooms: 0, files: 0, failed: 0 });

  const setSubmitterField = (key, value) =>
    setSubmitter((s) => ({ ...s, [key]: value }));

  const parseFile = async (file) => {
    setError("");
    setParsed(null);
    setResult(null);
    setFileName(file.name);
    setParsing(true);

    try {
      // xlsx is loaded on demand — it is a big dependency and most visitors
      // fill in the form instead.
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      // raw:true — see DATE HANDLING in utils/propertyCsv.js. Letting xlsx
      // guess types rewrites "5-10" (a transportMinutes value) as a date.
      const workbook = XLSX.read(buffer, { raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (raw.length === 0) {
        setError("That file has a header row but no data rows.");
        setParsing(false);
        return;
      }

      const warnings = unknownHeaders(raw[0]);
      const rows = raw.map(canonicalizeRow);
      const { properties, errors } = rowsToProperties(rows);

      if (properties.length === 0) {
        setError(
          errors[0] ||
            "We couldn't find any properties in that file. Start from the sample CSV."
        );
        setParsing(false);
        return;
      }

      setParsed({ properties, errors, warnings });
    } catch (err) {
      console.error("CSV parse error:", err);
      setError(
        "Could not read that file. Use a .csv or .xlsx laid out like the sample."
      );
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!submitter.name.trim()) {
      setError("Please tell us your name before importing.");
      return;
    }
    if (!isEmail(submitter.email.trim())) {
      setError("Please enter a valid email address before importing.");
      return;
    }

    setImporting(true);
    setError("");
    setRowState(parsed.properties.map(() => "pending"));
    setTally({ saved: 0, rooms: 0, files: 0, failed: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });

    const sender = {
      role: submitter.role,
      name: submitter.name.trim(),
      company: submitter.company.trim(),
      email: submitter.email.trim(),
      phone: submitter.phone.trim(),
    };

    const merged = { total: 0, created: 0, failed: 0, results: [] };
    const markRow = (index, state) =>
      setRowState((prev) => prev.map((s, i) => (i === index ? state : s)));

    for (const [index, entry] of parsed.properties.entries()) {
      const { rowNumbers, ...payload } = entry;
      markRow(index, "saving");
      merged.total += 1;

      try {
        const res = await api.post(
          `/public/organizations/${encodeURIComponent(slug)}/properties/bulk`,
          { submittedBy: sender, properties: [payload] }
        );

        const row = res.data?.data?.results?.[0];
        merged.created += 1;
        merged.results.push(row || { name: payload.property.name, ok: true });
        markRow(index, "done");
        setTally((t) => ({
          ...t,
          saved: t.saved + 1,
          rooms: t.rooms + (row?.rooms || 0),
          files: t.files + (row?.mirrored || 0),
        }));
      } catch (err) {
        // A property the server rejected comes back as a 400 carrying its own
        // per-row reason; anything else (rate limit, network, server error) is
        // not specific to this property, so stop rather than hammer on.
        const row = err.response?.data?.data?.results?.[0];

        if (!row) {
          console.error("Import aborted:", err);
          setError(
            err.response?.data?.message ||
              "The import stopped partway through. The properties already saved are safe — remove those rows and upload the rest."
          );
          markRow(index, "failed");
          setImporting(false);
          if (merged.created > 0) setResult(merged);
          return;
        }

        merged.failed += 1;
        merged.results.push(row);
        markRow(index, "failed");
        setTally((t) => ({ ...t, failed: t.failed + 1 }));
      }
    }

    setResult(merged);
    setImporting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- in progress ----------------------------------------------------------
  // Each property takes a few seconds because its photos and documents are
  // fetched into Cloudinary before it is saved, so the wait is narrated rather
  // than hidden behind a spinner.
  if (importing) {
    const total = parsed?.properties.length || 0;
    const settled = rowState.filter((s) => s === "done" || s === "failed").length;
    const percent = total ? Math.round((settled / total) * 100) : 0;
    const currentIndex = rowState.findIndex((s) => s === "saving");
    const current = currentIndex === -1 ? null : parsed.properties[currentIndex];
    const currentFiles = current ? fileCountOf(current) : 0;

    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 size={22} className="text-[#F47C3C] animate-spin shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#0F253B]">
                Importing your properties
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Saving one at a time and copying every photo and document into{" "}
                {organization?.name || "the agency"}&apos;s media library. Please
                keep this tab open.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#0F253B]">
                {settled} of {total} done
              </p>
              <p className="text-[11px] font-bold text-gray-400">{percent}%</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F47C3C] rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {current && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs font-bold text-[#0F253B] flex items-center gap-2">
                <Loader2 size={13} className="animate-spin shrink-0" />
                {current.property.name}
              </p>
              <p className="text-[11px] font-medium text-gray-600 mt-1.5">
                {currentFiles > 0
                  ? `Downloading ${currentFiles} file${
                      currentFiles === 1 ? "" : "s"
                    } and storing ${
                      currentFiles === 1 ? "it" : "them"
                    } in Cloudinary…`
                  : "Saving the property…"}
                {current.rooms.length > 0 &&
                  ` Then ${current.rooms.length} room${
                    current.rooms.length === 1 ? "" : "s"
                  }.`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              [Building2, tally.saved, "properties saved"],
              [Bed, tally.rooms, "rooms created"],
              [ImageIcon, tally.files, "files in Cloudinary"],
            ].map(([Icon, value, label]) => (
              <div
                key={label}
                className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center"
              >
                <Icon size={14} className="mx-auto text-[#F47C3C]" />
                <p className="text-lg font-bold text-[#0F253B] mt-1">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-1">
          {parsed.properties.map((entry, i) => {
            const state = rowState[i];
            const files = fileCountOf(entry);

            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0 ${
                  state === "pending" ? "opacity-40" : ""
                }`}
              >
                {state === "done" && (
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                )}
                {state === "failed" && (
                  <XCircle size={15} className="text-red-500 shrink-0" />
                )}
                {state === "saving" && (
                  <Loader2 size={15} className="text-[#F47C3C] animate-spin shrink-0" />
                )}
                {state === "pending" && (
                  <span className="w-[15px] h-[15px] rounded-full border-2 border-gray-200 shrink-0" />
                )}

                <p className="text-xs font-bold text-[#0F253B] truncate flex-1">
                  {entry.property.name}
                </p>
                <p className="text-[11px] font-medium text-gray-400 shrink-0">
                  {entry.rooms.length > 0 &&
                    `${entry.rooms.length} room${entry.rooms.length === 1 ? "" : "s"}`}
                  {entry.rooms.length > 0 && files > 0 && " · "}
                  {files > 0 && `${files} file${files === 1 ? "" : "s"}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- result ---------------------------------------------------------------
  if (result) {
    const failures = result.results.filter((r) => !r.ok);

    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center space-y-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
              result.created > 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-500"
            }`}
          >
            {result.created > 0 ? (
              <CheckCircle2 size={28} />
            ) : (
              <XCircle size={28} />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F253B]">
              {result.created} of {result.total} properties added
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              They are live on {organization?.name || "the agency"}&apos;s books
              now. Your details are on each one at{" "}
              <span className="text-[#0F253B]">{submitter.email}</span> if
              anything needs checking.
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">
            Import report
          </p>
          {result.results.map((row, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 text-sm border-b border-gray-50 last:border-0 py-2"
            >
              {row.ok ? (
                <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-[#0F253B] truncate">{row.name}</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  {row.ok
                    ? [
                        row.reference,
                        row.rooms ? `${row.rooms} room${row.rooms === 1 ? "" : "s"}` : "",
                        // Photos and documents copied out of wherever they were
                        // linked from and into the agency's own media library.
                        row.mirrored
                          ? `${row.mirrored} file${row.mirrored === 1 ? "" : "s"} stored`
                          : "",
                        row.keptRemote
                          ? `${row.keptRemote} link${
                              row.keptRemote === 1 ? "" : "s"
                            } could not be fetched`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : row.error}
                </p>
              </div>
            </div>
          ))}
        </div>

        {failures.length > 0 && (
          <p className="text-xs text-gray-400 font-medium">
            Fix the {failures.length} failed row
            {failures.length === 1 ? "" : "s"} in your spreadsheet and upload just
            those — the ones already accepted are not duplicated by a second file.
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setResult(null);
            setParsed(null);
            setFileName("");
            setRowState([]);
            setTally({ saved: 0, rooms: 0, files: 0, failed: 0 });
          }}
          className="text-sm font-bold text-[#F47C3C] hover:text-[#0F253B]"
        >
          Import another file
        </button>
      </div>
    );
  }

  const totalRooms =
    parsed?.properties.reduce((sum, p) => sum + p.rooms.length, 0) || 0;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">
            Import a spreadsheet
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Got a portfolio? Send the whole lot in one file instead of filling in
            the form for each property.
          </p>
        </div>

        <a
          href={SAMPLE_PATH}
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F253B] hover:bg-[#183a5a] text-white text-xs font-bold rounded-xl transition-all"
        >
          <Download size={15} /> Download the sample CSV ({CSV_COLUMNS.length}{" "}
          columns)
        </a>
        <p className="text-[11px] text-gray-400 font-medium">
          Four worked properties in one file: an HMO with three rooms, a flat let
          as a whole, a weekly short let, and a two-unit block — covering every
          rental type, both ways of laying out a multi-room property, and the
          full set of columns.
        </p>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-[#0F253B]">
              A property with several rooms
            </p>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed mt-1">
              <strong>One row per room.</strong> Give every room of the same
              property the same <code className="text-[#0F253B]">propertyRef</code>.
              The first of those rows carries the property columns; the rows under
              it need only their own room columns:
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="text-[11px] font-medium border border-gray-200 rounded-lg overflow-hidden bg-white">
              <thead className="bg-white">
                <tr className="text-gray-400">
                  {["propertyRef", "propertyName", "addressLine1", "roomName", "monthlyRent"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-2.5 py-1.5 text-left font-bold whitespace-nowrap border-b border-gray-200"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="text-[#0F253B]">
                {[
                  ["MELROSE-01", "Melrose House", "18 Melrose Terrace", "Room 1", "695"],
                  ["MELROSE-01", "", "", "Room 2", "560"],
                  ["MELROSE-01", "", "", "Room 3", "620"],
                  ["CHAPEL-42", "42 Chapel Street", "42 Chapel Street", "", ""],
                ].map((cells, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    {cells.map((cell, j) => (
                      <td key={j} className="px-2.5 py-1.5 whitespace-nowrap">
                        {cell || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
            That is 2 properties: Melrose House with 3 rooms, and 42 Chapel Street
            let as a whole — a single row with every room column left blank. Lists
            (amenities, photos) are separated with{" "}
            <code className="text-[#0F253B]">|</code>, dates are{" "}
            <code className="text-[#0F253B]">yyyy-mm-dd</code>, and{" "}
            <code className="text-[#0F253B]">propertyName</code> and{" "}
            <code className="text-[#0F253B]">addressLine1</code> are the only
            required columns.
          </p>
        </div>

        <details className="group">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-[#0F253B] list-none">
            <ChevronDown
              size={14}
              className="transition-transform group-open:rotate-180"
            />
            Column reference ({CSV_COLUMNS.length} columns)
          </summary>
          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {COLUMN_HELP.map(([column, help]) => (
              <div key={column} className="text-[11px] leading-relaxed">
                <code className="font-bold text-[#0F253B]">{column}</code>
                <span className="text-gray-500 font-medium"> — {help}</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* who is sending it */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">
          Your details
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Full name *</label>
            <input
              className={FIELD}
              value={submitter.name}
              onChange={(e) => setSubmitterField("name", e.target.value)}
              placeholder="e.g., Sarah Ahmed"
            />
          </div>
          <div>
            <label className={LABEL}>Company</label>
            <input
              className={FIELD}
              value={submitter.company}
              onChange={(e) => setSubmitterField("company", e.target.value)}
              placeholder="e.g., Melrose Lettings"
            />
          </div>
          <div>
            <label className={LABEL}>Email *</label>
            <input
              className={FIELD}
              type="email"
              value={submitter.email}
              onChange={(e) => setSubmitterField("email", e.target.value)}
              placeholder="you@agency.co.uk"
            />
          </div>
          <div>
            <label className={LABEL}>Phone</label>
            <input
              className={FIELD}
              value={submitter.phone}
              onChange={(e) => setSubmitterField("phone", e.target.value)}
              placeholder="07700 900123"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 font-medium">
          Applied to every property in the file.
        </p>
      </div>

      {/* file */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) parseFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragging
              ? "border-[#F47C3C] bg-orange-50"
              : "border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50"
          }`}
        >
          {parsing ? (
            <Loader2 size={28} className="mx-auto text-[#F47C3C] animate-spin" />
          ) : fileName ? (
            <FileSpreadsheet size={28} className="mx-auto text-[#F47C3C]" />
          ) : (
            <UploadCloud size={28} className="mx-auto text-gray-300" />
          )}
          <p className="text-sm font-bold text-[#0F253B] mt-2">
            {parsing
              ? "Reading the file…"
              : fileName || "Drop your CSV here or click to browse"}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1">
            .csv, .xlsx or .xls — the first sheet is used
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) parseFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        {parsed && (
          <>
            <div className="flex items-center gap-4 flex-wrap bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Building2 size={14} /> {parsed.properties.length} propert
                {parsed.properties.length === 1 ? "y" : "ies"}
              </p>
              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Bed size={14} /> {totalRooms} room{totalRooms === 1 ? "" : "s"}
              </p>
            </div>

            {parsed.warnings.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] font-medium text-amber-800">
                  Ignored {parsed.warnings.length} column
                  {parsed.warnings.length === 1 ? "" : "s"} we don&apos;t
                  recognise: {parsed.warnings.slice(0, 6).join(", ")}
                  {parsed.warnings.length > 6 ? "…" : ""}
                </p>
              </div>
            )}

            {parsed.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold text-red-800 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {parsed.errors.length} row
                  {parsed.errors.length === 1 ? "" : "s"} will be skipped
                </p>
                {parsed.errors.slice(0, 8).map((message, i) => (
                  <p key={i} className="text-[11px] font-medium text-red-700">
                    {message}
                  </p>
                ))}
                {parsed.errors.length > 8 && (
                  <p className="text-[11px] font-medium text-red-700">
                    …and {parsed.errors.length - 8} more.
                  </p>
                )}
              </div>
            )}

            {/* preview */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Property", "Type", "Address", "Owner", "Rooms"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.properties.slice(0, 12).map((entry, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-3 py-2.5 text-xs font-bold text-[#0F253B] whitespace-nowrap">
                          {entry.property.name}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">
                          {entry.property.rentalType}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">
                          {[entry.property.address.line1, entry.property.address.city]
                            .filter(Boolean)
                            .join(", ")}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">
                          {entry.owner.name || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-500">
                          {entry.rooms.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.properties.length > 12 && (
                <p className="px-3 py-2 text-[11px] font-medium text-gray-400 bg-gray-50 border-t border-gray-100">
                  …and {parsed.properties.length - 12} more.
                </p>
              )}
            </div>

            {/* The importing state has a screen of its own, so this button
                only ever renders in its idle form. */}
            <button
              type="button"
              onClick={runImport}
              className="flex items-center gap-2 px-6 py-3 bg-[#F47C3C] hover:bg-[#e06a2b] text-white font-bold text-sm rounded-xl transition-all"
            >
              <UploadCloud size={17} /> Submit {parsed.properties.length} propert
              {parsed.properties.length === 1 ? "y" : "ies"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
