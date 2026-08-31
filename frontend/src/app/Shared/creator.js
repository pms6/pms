"use client";

import { UserCircle2, BadgeCheck } from "lucide-react";

// Who added a lead or a viewing.
//
// There is no name field on a User anywhere in this system — accounts are
// identified by email — so the display name is the local part of the address,
// the same convention the tasks board uses (see Shared/tasks.js displayName).
// The full address is always in the title attribute for when the local part is
// ambiguous.

const ROLE_LABEL = {
  OWNER: "Owner",
  MANAGER: "Manager",
  AGENT: "Agent",
  FINANCE: "Finance",
};

export const nameFromEmail = (email) => (email ? String(email).split("@")[0] : "");

/**
 * Resolve the creator of a lead or viewing for display, or null when the record
 * carries nothing to show.
 *
 * `createdByEmail` / `createdByRole` are written at creation. Rows that predate
 * those fields fall back to the populated `createdBy` ref, which yields a name
 * but no role.
 */
export function creatorOf(record) {
  const email = record?.createdByEmail || record?.createdBy?.email || "";
  const role = record?.createdByRole || "";

  // A website enquiry is created by the ENQUIRER's own account, not by anyone
  // on the team, so naming them as the member who added it would be wrong. An
  // empty role on a Website-sourced lead is exactly that case.
  if (!role && record?.source === "Website") {
    return { label: "Website enquiry", email: "", role: "", isPublic: true };
  }

  if (!email) return null;

  return {
    label: nameFromEmail(email),
    email,
    role: ROLE_LABEL[role] || "",
    isPublic: false,
  };
}

/**
 * The "Added by <member>" line shown on lead cards, the lead detail modal and
 * viewing cards.
 */
export function AddedBy({ record, verb = "Added by", className = "" }) {
  const creator = creatorOf(record);
  if (!creator) return null;

  if (creator.isPublic) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 ${className}`}
      >
        <UserCircle2 size={12} />
        {creator.label}
      </span>
    );
  }

  return (
    <span
      title={creator.email}
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 ${className}`}
    >
      <UserCircle2 size={12} />
      {verb} <span className="font-bold text-gray-500">{creator.label}</span>
      {creator.role && (
        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
          {creator.role}
        </span>
      )}
    </span>
  );
}

/**
 * Who approved a lead out of the "pending" column, or null while it is still
 * waiting. Same denormalised-with-ref fallback as creatorOf above.
 */
export function approverOf(record) {
  if (!record?.approvedAt) return null;

  const email = record.approvedByEmail || record.approvedBy?.email || "";
  const role = record.approvedByRole || "";

  return {
    label: nameFromEmail(email) || "a team member",
    email,
    role: ROLE_LABEL[role] || "",
    at: record.approvedAt,
  };
}

/**
 * The "Approved by <member>" line. Visible to every role — the whole team can
 * see which colleague signed a lead off, and hovering gives the full address
 * and the date.
 */
export function ApprovedBy({ record, className = "" }) {
  const approver = approverOf(record);
  if (!approver) return null;

  const when = approver.at ? new Date(approver.at).toLocaleDateString() : "";

  return (
    <span
      title={[approver.email, when].filter(Boolean).join(" • ")}
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 ${className}`}
    >
      <BadgeCheck size={12} />
      Approved by <span className="font-bold">{approver.label}</span>
      {approver.role && (
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5">
          {approver.role}
        </span>
      )}
    </span>
  );
}
