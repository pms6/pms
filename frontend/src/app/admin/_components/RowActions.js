"use client";

import { Eye, Download, Pencil, Trash2 } from "lucide-react";

/**
 * The four row actions the registers share: view, download, edit, delete.
 *
 * Each is rendered only when a handler is given, so a screen that cannot edit
 * a particular row simply omits `onEdit` rather than showing a dead button.
 * `editTitle` and `deleteTitle` exist because on the derived screens the row is
 * not the record being changed — on the deposit register "Delete" removes the
 * check-out that settled the deposit, and saying so in the tooltip is the
 * difference between a considered click and a surprise.
 */
export default function RowActions({
  onView,
  onDownload,
  onEdit,
  onDelete,
  viewTitle = "View",
  downloadTitle = "Download this row as CSV",
  editTitle = "Edit",
  deleteTitle = "Delete",
  busy = false,
}) {
  const base =
    "p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-end gap-1">
      {onView && (
        <button
          type="button"
          onClick={onView}
          title={viewTitle}
          className={`${base} text-gray-400 hover:text-[#0F253B] hover:bg-gray-100`}
        >
          <Eye size={16} />
        </button>
      )}

      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          title={downloadTitle}
          className={`${base} text-gray-400 hover:text-[#0F253B] hover:bg-gray-100`}
        >
          <Download size={16} />
        </button>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title={editTitle}
          className={`${base} text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50`}
        >
          <Pencil size={16} />
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          title={deleteTitle}
          className={`${base} text-gray-400 hover:text-red-600 hover:bg-red-50`}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
