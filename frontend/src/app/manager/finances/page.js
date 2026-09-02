"use client";

// The manager portal shows the same screen as the owner portal. Every request
// the page makes is scoped to the organization by the API, and the role guard
// lives in manager/layout.js, so this re-exports the one implementation rather
// than keeping a second copy that would drift.
export { default } from "../../admin/finances/page";
