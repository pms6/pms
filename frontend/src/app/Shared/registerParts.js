"use client";

import { X, Pencil, Trash2, Eye, Loader2, Film, FileText } from "lucide-react";
import { AttachmentRow, previewKind } from "./MediaAttachments";
import { guardModalClose } from "@/app/Shared/modalGuard";

/* ------------------------------------------------------------------ *
 * The pieces every register board is built from — the field styles, the
 * thumbnail strip, the add/edit modal frame, the read-only detail blocks and
 * the row actions. Garden and Court Claims share them, so a change to how a
 * register looks is made once.
 * ------------------------------------------------------------------ */

export const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
export const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

export const money = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const toInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const filesOf = (list) => (Array.isArray(list) ? list : []);
// A few thumbnails for a cell's files; clicking opens the viewer on them.
export function FileStrip({ files, onOpen }) {
  if (files.length === 0) return <span className="text-gray-300">—</span>;

  const shown = files.slice(0, 3);
  const extra = files.length - shown.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`View ${files.length} file${files.length === 1 ? "" : "s"}`}
      className="flex items-center gap-1"
    >
      {shown.map((f, i) => {
        const kind = previewKind(f);
        return kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={(f.url || "") + i}
            src={f.url}
            alt={f.name || "Attachment"}
            className="h-10 w-10 rounded-lg border border-gray-100 bg-gray-50 object-cover"
          />
        ) : (
          <span
            key={(f.url || "") + i}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-gray-400"
          >
            {kind === "video" ? <Film size={16} /> : <FileText size={16} />}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="text-[11px] font-bold text-gray-400">+{extra}</span>
      )}
    </button>
  );
}

export function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={guardModalClose(onClose)}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">{title}</h3>
            <p className="text-xs text-gray-400 font-medium">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Picking from the portfolio fills the address; the field stays editable
// because the sheets carry addresses that aren't property records yet.
export function PropertyFields({ form, setForm, properties }) {
  const onPick = (e) => {
    const propertyId = e.target.value;
    const name = properties.find((p) => p._id === propertyId)?.name || "";
    setForm((f) => ({ ...f, propertyId, property: name || f.property }));
  };

  return (
    <>
      <div>
        <label className={LABEL}>Pick from portfolio</label>
        <select className={FIELD} value={form.propertyId} onChange={onPick}>
          <option value="">Not linked — type the address below</option>
          {properties.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Property</label>
        <input
          className={FIELD}
          value={form.property}
          onChange={(e) => setForm((f) => ({ ...f, property: e.target.value }))}
          placeholder="e.g. 7 Exeter Road NW2 4SJ"
          required
        />
      </div>
    </>
  );
}

export const ErrorBanner = ({ children }) =>
  children ? (
    <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
      {children}
    </div>
  ) : null;

export const SubmitButton = ({ saving, isEdit }) => (
  <button
    type="submit"
    disabled={saving}
    className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]"
  >
    {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Entry"}
  </button>
);

export function ViewRow({ label, children }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className="text-sm font-semibold text-[#0F253B] break-words">{children || "—"}</p>
    </div>
  );
}

// One labelled group of attachments, each with its thumbnail and download.
export function FilesBlock({ label, files, onOpen }) {
  return (
    <div>
      <p className={LABEL}>
        {label} <span className="text-gray-300">({files.length})</span>
      </p>
      {files.length === 0 ? (
        <p className="text-sm font-medium text-gray-300">Nothing attached.</p>
      ) : (
        <>
          <div className="space-y-2">
            {files.map((f, i) => (
              <AttachmentRow key={(f.url || "") + i} file={f} />
            ))}
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"
          >
            <Eye size={13} /> Open the viewer
          </button>
        </>
      )}
    </div>
  );
}

export const RowActions = ({ onView, onEdit, onDelete }) => (
  <div className="flex items-center justify-end gap-1">
    <button onClick={onView} title="View" className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"><Eye size={16} /></button>
    <button onClick={onEdit} title="Edit" className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
    <button onClick={onDelete} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
  </div>
);

export const EmptyRow = ({ colSpan, loading, anyRows, emptyText }) => (
  <tr>
    <td colSpan={colSpan} className="px-5 py-14 text-center text-gray-400">
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" />
      ) : (
        <p className="font-medium">{anyRows ? "No entries match these filters" : emptyText}</p>
      )}
    </td>
  </tr>
);
