"use client";

import { X } from "lucide-react";
import { Badge } from "../../Shared/ui";

/**
 * The "view" modal the registers share.
 *
 * Takes plain data rather than markup — `sections` is
 * [{ title, rows: [{ label, value, tone?, hide? }] }] — so each screen decides
 * what a record's detail is without six near-identical modals existing.
 *
 * A row whose value is empty is dropped rather than rendered as a dash: on
 * these records most fields are optional, and a detail view that is nine tenths
 * em dashes hides the handful of fields that were actually filled in.
 */
export default function RecordDetail({ title, subtitle, sections = [], footer, onClose }) {
  const isEmpty = (v) => v === null || v === undefined || v === "" || v === "—";

  const visible = sections
    .map((s) => ({ ...s, rows: (s.rows || []).filter((r) => r && !r.hide && !isEmpty(r.value)) }))
    .filter((s) => s.rows.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] break-words">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 font-medium">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-gray-300 font-medium">Nothing recorded on this row yet.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((section) => (
              <div key={section.title} className="rounded-2xl border border-gray-100 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.rows.map((row) => (
                    <div key={row.label} className="flex gap-3 text-sm">
                      <span className="text-gray-400 font-medium w-36 shrink-0">{row.label}</span>
                      {row.tone ? (
                        <Badge tone={row.tone}>{row.value}</Badge>
                      ) : (
                        // min-w-0 + wrap-anywhere rather than break-words:
                        // break-words leaves a flex item's min-content width
                        // untouched, so a long unbroken value — an email
                        // address, typically — would push past the row instead
                        // of wrapping inside it.
                        <span className="min-w-0 text-[#0F253B] font-semibold wrap-anywhere">
                          {row.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
