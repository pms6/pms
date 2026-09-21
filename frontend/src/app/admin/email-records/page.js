"use client";

import EmailRecordsBoard from "../../Shared/EmailRecordsBoard";

// The board itself lives in Shared/EmailRecordsBoard so another staff portal
// can mount the same log later.
export default function AdminEmailRecords() {
  return (
    <EmailRecordsBoard subtitle="Property management email communication log — replies, follow-ups and escalations" />
  );
}
