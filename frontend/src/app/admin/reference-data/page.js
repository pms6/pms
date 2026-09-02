"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Download, X, Pencil, Trash2, Eye, Paperclip, Link2,
  ShieldCheck, ShieldAlert, UserCheck, FileText, Loader2, UploadCloud,
} from "lucide-react";
import { PageHeader, StatCard, Badge } from "../../Shared/ui";
import api from "../../api/api";
import {
  uploadAnyFileToCloudinary,
  downloadUrlFor,
  formatBytes,
} from "../../utils/uploadToCloudinary";
import { fileKind, kindLabel } from "../../Shared/fileType";
import {
  date,
  dateInput,
  MONTHS,
  yearOptions,
  REFERENCE_STATUSES,
  REFERENCE_STATUS_LABEL,
  REFERENCE_STATUS_TONE,
  REFERENCE_BLOCKS,
  KIN_RELATIONSHIPS,
  isCollected,
  exportCsv,
  exportRowCsv,
} from "../../utils/registers";

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";
const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

// The template's columns, defined once so the full export and a single-row
// download can never describe a client's references differently.
const COLUMNS = [
  { header: "Property Name", value: (r) => r.property },
  { header: "Room", value: (r) => r.room },
  { header: "Client Name", value: (r) => r.tenant },
  { header: "Client Email", value: (r) => r.tenantEmail },
  { header: "Client Contact", value: (r) => r.tenantPhone },
  { header: "Ex Landlord Name", value: (r) => r.exLandlord?.name || "" },
  { header: "Ex Landlord Contact Number", value: (r) => r.exLandlord?.contact || r.exLandlord?.note || "" },
  { header: "Ex Landlord Email", value: (r) => r.exLandlord?.email || "" },
  { header: "Ex Landlord Status", value: (r) => REFERENCE_STATUS_LABEL[r.exLandlord?.status] || "" },
  { header: "Job Name", value: (r) => r.employer?.name || "" },
  { header: "Job Contact Number", value: (r) => r.employer?.contact || r.employer?.note || "" },
  { header: "Job Email", value: (r) => r.employer?.email || "" },
  { header: "Job Status", value: (r) => REFERENCE_STATUS_LABEL[r.employer?.status] || "" },
  { header: "Kin Relationship", value: (r) => r.nextOfKin?.relationship || "" },
  { header: "Kin Name", value: (r) => r.nextOfKin?.name || "" },
  { header: "Kin Contact Number", value: (r) => r.nextOfKin?.contact || "" },
  { header: "Kin Email", value: (r) => r.nextOfKin?.email || "" },
  { header: "Kin Status", value: (r) => REFERENCE_STATUS_LABEL[r.nextOfKin?.status] || "" },
  { header: "Documents", value: (r) => (r.documents || []).map((d) => d.name || d.url).join(" | ") || r.documentsNote || "" },
  { header: "Recorded On", value: (r) => date(r.recordedOn) },
];

const emptyBlock = { name: "", contact: "", email: "", note: "", status: "PENDING" };

// Tone for the file-type chip. Images and PDFs are the two that preview, so
// they read differently from an arbitrary attachment.
const KIND_TONE = { image: "blue", pdf: "red", doc: "amber", other: "gray" };

/**
 * One attachment. `onRemove` makes it an editable row in the form; without it
 * the row is read-only, as it is in the detail view.
 *
 * A file uploaded to Cloudinary opens in a new tab, and downloads through
 * downloadUrlFor so it saves under its original name rather than the random
 * public_id. A pasted link is left exactly as given — we know nothing about
 * that host's rules.
 */
function DocumentRow({ doc, onRemove }) {
  const kind = fileKind(doc.url, doc.name);
  const label = doc.name || doc.url;
  const size = formatBytes(doc.bytes);

  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
      <FileText size={14} className="text-gray-400 shrink-0" />

      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-[#0F253B] hover:text-[#F47C3C] truncate"
        title={label}
      >
        {label}
      </a>

      <Badge tone={KIND_TONE[kind] || "gray"}>{kindLabel(doc.url, doc.name)}</Badge>
      {size && <span className="text-[11px] text-gray-300 font-medium shrink-0">{size}</span>}

      <div className="ml-auto flex items-center gap-1 shrink-0">
        <a
          href={downloadUrlFor(doc.url, doc.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"
          title="Download"
        >
          <Download size={14} />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
            title="Remove"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

const emptyForm = {
  checkInId: "",
  propertyId: "",
  property: "",
  room: "",
  tenant: "",
  tenantEmail: "",
  tenantPhone: "",
  exLandlord: { ...emptyBlock },
  employer: { ...emptyBlock },
  nextOfKin: { ...emptyBlock, relationship: "" },
  documents: [],
  documentsNote: "",
  recordedOn: "",
  notes: "",
};

/** One reference — the same four fields whichever of the three it is. */
function ReferenceFields({ label, block, onChange, withRelationship }) {
  const set = (k) => (e) => onChange({ ...block, [k]: e.target.value });

  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#0F253B]">{label}</p>
        <select
          value={block.status || "PENDING"}
          onChange={set("status")}
          className="px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          {REFERENCE_STATUSES.map((s) => (
            <option key={s} value={s}>{REFERENCE_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {withRelationship && (
        <div>
          <label className={LABEL}>Relationship</label>
          <input
            className={FIELD}
            list="kin-relationships"
            value={block.relationship || ""}
            onChange={set("relationship")}
            placeholder="Friend"
          />
          <datalist id="kin-relationships">
            {KIN_RELATIONSHIPS.map((r) => <option key={r} value={r} />)}
          </datalist>
        </div>
      )}

      <div>
        <label className={LABEL}>Name</label>
        <input className={FIELD} value={block.name || ""} onChange={set("name")} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Contact number</label>
          <input className={FIELD} value={block.contact || ""} onChange={set("contact")} />
        </div>
        <div>
          <label className={LABEL}>Email</label>
          <input className={FIELD} value={block.email || ""} onChange={set("email")} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Note</label>
        {/* Free text on purpose — the sheet puts things like "he lived with his
            parents" here, and that IS the reference. */}
        <input
          className={FIELD}
          value={block.note || ""}
          onChange={set("note")}
          placeholder="Lived with parents — no previous landlord"
        />
      </div>
    </div>
  );
}

function ReferenceModal({ initial, properties, candidates, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState(() => {
    if (!initial?._id) return emptyForm;
    return {
      ...emptyForm,
      ...initial,
      propertyId: initial.propertyId || "",
      checkInId: initial.checkInId || "",
      exLandlord: { ...emptyBlock, ...(initial.exLandlord || {}) },
      employer: { ...emptyBlock, ...(initial.employer || {}) },
      nextOfKin: { ...emptyBlock, relationship: "", ...(initial.nextOfKin || {}) },
      documents: initial.documents || [],
      recordedOn: dateInput(initial.recordedOn),
    };
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState({ name: "", url: "" });

  // Names of the files currently going up, so a multi-file selection shows
  // progress per file rather than one opaque spinner.
  const [uploading, setUploading] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBlock = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Picking the client fills the identity fields from their check-in.
  const pickClient = (e) => {
    const id = e.target.value;
    const c = candidates.find((x) => x._id === id);
    if (!c) {
      setForm((f) => ({ ...f, checkInId: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      checkInId: id,
      propertyId: c.propertyId || "",
      property: c.property || "",
      room: c.room || "",
      tenant: c.tenant || "",
      tenantEmail: c.email || "",
      tenantPhone: c.phone || "",
    }));
  };

  // A pasted link needs a URL — a name on its own has nothing behind it, and
  // the backend drops any attachment without one.
  const addDoc = () => {
    const url = doc.url.trim();
    if (!url) {
      setUploadError("A link needs a URL.");
      return;
    }
    setUploadError("");
    setForm((f) => ({
      ...f,
      documents: [...f.documents, { name: doc.name.trim() || url, url, uploadedAt: new Date() }],
    }));
    setDoc({ name: "", url: "" });
  };

  /**
   * Upload a batch of files of any type. Each is uploaded independently and
   * appended as it lands, so one rejected file does not lose the others — the
   * failures are collected and reported together at the end.
   */
  const uploadFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    setUploadError("");
    setUploading((prev) => [...prev, ...list.map((f) => f.name)]);

    const failures = [];

    await Promise.all(
      list.map(async (file) => {
        try {
          const up = await uploadAnyFileToCloudinary(file);
          setForm((f) => ({
            ...f,
            documents: [
              ...f.documents,
              {
                name: up.name,
                url: up.url,
                publicId: up.publicId,
                format: up.format,
                bytes: up.bytes,
                uploadedAt: new Date(),
              },
            ],
          }));
        } catch (err) {
          failures.push(err.message || `${file.name} failed to upload`);
        } finally {
          // Remove one occurrence of this name, not every match — two files can
          // legitimately be picked with the same name from different folders.
          setUploading((prev) => {
            const i = prev.indexOf(file.name);
            return i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
          });
        }
      })
    );

    if (failures.length) setUploadError(failures.join(" · "));
  };

  const onPickFiles = (e) => {
    uploadFiles(e.target.files);
    // Clear the input so picking the same file again still fires a change.
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer?.files);
  };

  const removeDoc = (i) =>
    setForm((f) => ({ ...f, documents: f.documents.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) return setError("A property is required.");
    if (!form.tenant.trim()) return setError("A client name is required.");
    // Saving mid-upload would drop whatever has not landed yet.
    if (uploading.length) return setError("Wait for the uploads to finish.");

    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the reference record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">
              {isEdit ? "Reference Data" : "New Reference Record"}
            </h3>
            <p className="text-xs text-gray-400 font-medium">
              Previous landlord, employer and next of kin
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {!isEdit && (
            <div>
              <label className={LABEL}>Client with no references yet</label>
              <select className={FIELD} value={form.checkInId} onChange={pickClient}>
                <option value="">Not linked — type the details below</option>
                {candidates.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.tenant} — {c.property}{c.room ? ` · ${c.room}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Property record</label>
              <select className={FIELD} value={form.propertyId} onChange={set("propertyId")}>
                <option value="">Not linked</option>
                {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Property name *</label>
              <input className={FIELD} value={form.property} onChange={set("property")} required />
            </div>
            <div>
              <label className={LABEL}>Room</label>
              <input className={FIELD} value={form.room} onChange={set("room")} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Client name *</label>
              <input className={FIELD} value={form.tenant} onChange={set("tenant")} required />
            </div>
            <div>
              <label className={LABEL}>Client email</label>
              <input type="email" className={FIELD} value={form.tenantEmail} onChange={set("tenantEmail")} />
            </div>
            <div>
              <label className={LABEL}>Client phone</label>
              <input className={FIELD} value={form.tenantPhone} onChange={set("tenantPhone")} />
            </div>
          </div>

          {/* The three references */}
          <ReferenceFields label="Ex Landlord" block={form.exLandlord} onChange={setBlock("exLandlord")} />
          <ReferenceFields label="Job" block={form.employer} onChange={setBlock("employer")} />
          <ReferenceFields label="Next of Kin" block={form.nextOfKin} onChange={setBlock("nextOfKin")} withRelationship />

          {/* Documents */}
          <div>
            <label className={LABEL}>Documents — any file type</label>

            {uploadError && (
              <div className="mb-2 p-2.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
                {uploadError}
              </div>
            )}

            <div className="space-y-2 mb-2">
              {form.documents.map((d, i) => (
                <DocumentRow key={d.url + i} doc={d} onRemove={() => removeDoc(i)} />
              ))}

              {/* Files still going up, shown in place so the operator can see
                  which of a multi-file selection is still running. */}
              {uploading.map((name) => (
                <div key={name} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <Loader2 size={14} className="text-[#F47C3C] shrink-0 animate-spin" />
                  <span className="text-sm font-medium text-gray-400 truncate">{name}</span>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-gray-300">
                    Uploading
                  </span>
                </div>
              ))}

              {form.documents.length === 0 && uploading.length === 0 && (
                <p className="text-xs text-gray-300 font-medium">
                  ID, payslips, previous tenancy agreement, employer letter…
                </p>
              )}
            </div>

            {/* Upload — any type, several at once. */}
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                dragging
                  ? "border-[#F47C3C] bg-orange-50 text-[#F47C3C]"
                  : "border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              <UploadCloud size={18} />
              <span className="text-xs font-bold">
                Drop files here, or click to choose — any file type, up to 10MB each
              </span>
              <input type="file" multiple className="hidden" onChange={onPickFiles} />
            </label>

            {/* Paperwork that already lives somewhere else keeps its link —
                which is exactly what the sheet's "Zahra Documents" column was. */}
            <div className="flex flex-wrap gap-2 mt-2">
              <input
                className={FIELD + " flex-1 min-w-[140px]"}
                value={doc.name}
                onChange={(e) => setDoc({ ...doc, name: e.target.value })}
                placeholder="Or link a document — name"
              />
              <input
                className={FIELD + " flex-1 min-w-[140px]"}
                value={doc.url}
                onChange={(e) => setDoc({ ...doc, url: e.target.value })}
                placeholder="https://…"
              />
              <button
                type="button"
                onClick={addDoc}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-50 border border-gray-100 hover:bg-gray-100 text-gray-500 font-bold text-xs rounded-xl"
              >
                <Link2 size={14} /> Add link
              </button>
            </div>

            <input
              className={FIELD + " mt-2"}
              value={form.documentsNote}
              onChange={set("documentsNote")}
              placeholder='Where the rest of the paperwork lives, e.g. "Zahra Documents"'
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Recorded on</label>
              <input type="date" className={FIELD} value={form.recordedOn} onChange={set("recordedOn")} />
            </div>
            <div>
              <label className={LABEL}>Notes</label>
              <input className={FIELD} value={form.notes} onChange={set("notes")} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add references"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Read-only detail of one record — all three references side by side. */
function ReferenceDetail({ row, onClose }) {
  const Line = ({ label, value }) =>
    value ? (
      <div className="flex gap-2 text-sm">
        <span className="text-gray-400 font-medium w-24 shrink-0">{label}</span>
        <span className="text-[#0F253B] font-semibold break-all">{value}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">{row.tenant}</h3>
            <p className="text-xs text-gray-400 font-medium">
              {row.property}{row.room ? ` · ${row.room}` : ""} · {date(row.recordedOn)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {REFERENCE_BLOCKS.map(({ key, label }) => {
            const block = row[key] || {};
            return (
              <div key={key} className="rounded-2xl border border-gray-100 p-4 space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                  <Badge tone={REFERENCE_STATUS_TONE[block.status] || "gray"}>
                    {REFERENCE_STATUS_LABEL[block.status] || "Pending"}
                  </Badge>
                </div>
                {isCollected(block) ? (
                  <>
                    <Line label="Relationship" value={block.relationship} />
                    <Line label="Name" value={block.name} />
                    <Line label="Contact" value={block.contact} />
                    <Line label="Email" value={block.email} />
                    <Line label="Note" value={block.note} />
                  </>
                ) : (
                  <p className="text-sm text-gray-300 font-medium">Nothing collected yet</p>
                )}
              </div>
            );
          })}

          {(row.documents?.length > 0 || row.documentsNote) && (
            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Documents
              </p>
              <div className="space-y-2">
                {(row.documents || []).map((d, i) => (
                  <DocumentRow key={d.url + i} doc={d} />
                ))}
                {row.documentsNote && (
                  <p className="text-sm text-gray-500 font-medium">{row.documentsNote}</p>
                )}
              </div>
            </div>
          )}

          {row.notes && (
            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</p>
              <p className="text-sm text-[#0F253B] font-medium">{row.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminReferenceData() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [properties, setProperties] = useState([]);
  const [candidates, setCandidates] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);

  const [f, setF] = useState({
    year: "",
    month: "",
    propertyId: "",
    status: "",
    incomplete: "",
    search: "",
  });

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
      const res = await api.get("/reference-data", { params });
      setRows(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reference data.");
    } finally {
      setLoading(false);
    }
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  // Refreshed after every save: adding references removes that client from the
  // "who still needs references" picker.
  const loadPickers = useCallback(async () => {
    try {
      const [props, without] = await Promise.all([
        api.get("/properties", { params: { limit: 200 } }),
        api.get("/reference-data/without-references"),
      ]);
      setProperties(props.data.data || []);
      setCandidates(without.data.data || []);
    } catch {
      // The form still works with typed details, so this is not worth a banner.
    }
  }, []);

  useEffect(() => {
    loadPickers();
  }, [loadPickers]);

  const save = async (form) => {
    if (modal?._id) {
      const res = await api.put(`/reference-data/${modal._id}`, form);
      const updated = res.data.data;
      setRows((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } else {
      await api.post("/reference-data", form);
      await load();
    }
    await loadPickers();
    setModal(null);
  };

  const remove = async (row) => {
    if (!confirm(`Delete the reference record for ${row.tenant}?`)) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/reference-data/${row._id}`);
      await loadPickers();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Failed to delete the reference record.");
    }
  };

  const csv = () => exportCsv("reference-data.csv", COLUMNS, rows);
  const downloadRow = (row) => exportRowCsv("references", row.tenant, COLUMNS, row);

  const years = useMemo(() => yearOptions(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reference Data"
        subtitle="Previous landlord, employer and next of kin collected for each client"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={csv}
              disabled={!rows.length}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 disabled:opacity-50 text-[#0F253B] font-bold text-sm rounded-xl"
            >
              <Download size={16} /> Export
            </button>
            <button
              onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> Add References
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserCheck} label="Clients" value={summary.total ?? 0} sub="with a reference record" />
        <StatCard icon={ShieldCheck} label="All three collected" value={summary.complete ?? 0} />
        <StatCard icon={ShieldCheck} label="Fully verified" value={summary.fullyVerified ?? 0} tone="navy" />
        <StatCard icon={ShieldAlert} label="Failed" value={summary.failed ?? 0} sub="need chasing" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={f.search}
            onChange={set("search")}
            placeholder="Search client, property or referee name…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <select value={f.year} onChange={set("year")} className={CONTROL}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={f.month} onChange={set("month")} className={CONTROL} disabled={!f.year}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>

        <select value={f.propertyId} onChange={set("propertyId")} className={CONTROL}>
          <option value="">All properties</option>
          {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>

        <select value={f.status} onChange={set("status")} className={CONTROL}>
          <option value="">Any status</option>
          {REFERENCE_STATUSES.map((s) => (
            <option key={s} value={s}>{REFERENCE_STATUS_LABEL[s]}</option>
          ))}
        </select>

        <button
          onClick={() => setF((prev) => ({ ...prev, incomplete: prev.incomplete ? "" : "true" }))}
          className={`px-3.5 py-2.5 text-sm font-bold rounded-xl border transition-all ${
            f.incomplete
              ? "bg-[#0F253B] text-white border-[#0F253B]"
              : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
          }`}
        >
          Incomplete only
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Property &amp; Room</th>
                <th className="px-5 py-3">Ex Landlord</th>
                <th className="px-5 py-3">Job</th>
                <th className="px-5 py-3">Next of Kin</th>
                <th className="px-5 py-3">Collected</th>
                <th className="px-5 py-3">Docs</th>
                <th className="px-5 py-3">Recorded</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">Loading reference data…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">No reference records match these filters</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-bold text-[#0F253B]">{r.tenant}</p>
                      <p className="text-[11px] text-gray-400">{r.tenantEmail || r.tenantPhone || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#0F253B]">{r.property}</p>
                      <p className="text-[11px] text-gray-400">{r.room || "—"}</p>
                    </td>

                    {REFERENCE_BLOCKS.map(({ key }) => {
                      const block = r[key] || {};
                      return (
                        <td key={key} className="px-5 py-3">
                          {isCollected(block) ? (
                            <>
                              <Badge tone={REFERENCE_STATUS_TONE[block.status] || "gray"}>
                                {REFERENCE_STATUS_LABEL[block.status] || "Pending"}
                              </Badge>
                              <p className="text-[11px] text-gray-400 mt-1 max-w-[160px] truncate">
                                {block.name || block.contact || block.email || block.note}
                              </p>
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-5 py-3">
                      <span
                        className={`text-[11px] font-bold ${
                          r.score?.collected === r.score?.total ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {r.score?.collected ?? 0}/{r.score?.total ?? 3}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {r.documents?.length ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F253B]">
                          <Paperclip size={13} className="text-gray-400" />
                          {r.documents.length}
                        </span>
                      ) : r.documentsNote ? (
                        <span className="text-[11px] font-bold text-gray-400">note only</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{date(r.recordedOn)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetail(r)} className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg" title="View">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => downloadRow(r)} className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg" title="Download this row as CSV">
                          <Download size={16} />
                        </button>
                        <button onClick={() => setModal(r)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(r)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
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

      {modal !== null && (
        <ReferenceModal
          initial={modal}
          properties={properties}
          candidates={candidates}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {detail && <ReferenceDetail row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
