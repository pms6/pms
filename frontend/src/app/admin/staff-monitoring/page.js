"use client";

import StaffMonitoringBoard from "../../Shared/StaffMonitoringBoard";

// Owner and admin only — the API refuses everyone else, including MANAGER, so
// this page is deliberately absent from the manager portal rather than shown
// and then erroring.
export default function AdminStaffMonitoring() {
  return <StaffMonitoringBoard />;
}
