"use client";

import { X } from "lucide-react";
import { applicantEntries } from "./applicant";

// The Kanban card is too small for the full screening answers, so the Leads
// boards (admin, agent, manager) all open this for the detail view.

function initials(name) {
  return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function roomName(room) {
  if (!room) return "";
  return room.roomName || room.title || room.name || "Unnamed Room";
}

export default function LeadDetailModal({ lead, onClose }) {
  const answers = applicantEntries(lead.applicant);
  const property = lead.propertyId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-sm font-bold shrink-0">
              {initials(lead.name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-[#0F253B] truncate">{lead.name}</h3>
              <p className="text-xs text-gray-400 font-medium capitalize">
                {lead.source} • {lead.status}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        {lead.status === "lost" && lead.lostReason && (
          <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-xl">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">
              Lost
            </p>
            <p className="text-sm font-bold text-red-800 whitespace-pre-wrap break-words">
              {lead.lostReason}
            </p>
            {lead.lostAt && (
              <p className="text-xs text-red-400 font-medium mt-1">
                {new Date(lead.lostAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        <DetailSection title="Contact">
          <DetailRow label="Email" value={lead.email} />
          <DetailRow label="Phone" value={lead.phone} />
        </DetailSection>

        <DetailSection title="Interested in">
          <DetailRow label="Property" value={property?.name || lead.interestedIn} />
          <DetailRow label="Room" value={roomName(lead.roomId)} />
          <DetailRow label="Budget" value={lead.budget > 0 ? `£${lead.budget}/mo` : ""} />
          <DetailRow label="Assigned to" value={lead.assignedTo} />
        </DetailSection>

        <DetailSection title="Applicant details">
          {answers.length ? (
            answers.map((a) => <DetailRow key={a.key} label={a.label} value={a.value} />)
          ) : (
            <p className="text-sm text-gray-400 font-medium py-1">
              No screening answers — this lead wasn&apos;t created from the website request form.
            </p>
          )}
        </DetailSection>

        {lead.notes && (
          <DetailSection title="Notes">
            <p className="text-sm text-gray-600 font-medium whitespace-pre-wrap">{lead.notes}</p>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 pb-1.5">
      <span className="text-sm text-gray-400 font-medium shrink-0">{label}</span>
      <span className="text-sm font-bold text-[#0F253B] text-right break-words">{value}</span>
    </div>
  );
}
