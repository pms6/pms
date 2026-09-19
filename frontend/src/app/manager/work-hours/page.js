"use client";

// The manager portal reports on exactly the same figures as the admin portal —
// the API allows OWNER, ADMIN and MANAGER to read working hours, while the
// screenshots behind them stay owner/admin only. Re-exported rather than copied
// so the two portals cannot drift.
export { default } from "../../admin/work-hours/page";
