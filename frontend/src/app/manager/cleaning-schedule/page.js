"use client";

// Same board as the admin portal — see Shared/CleaningScheduleBoard. Every
// request is scoped to the organization by the API and the role guard lives in
// manager/layout.js, so this re-exports the one implementation rather than
// keeping a second copy that would drift.
export { default } from "../../admin/cleaning-schedule/page";
