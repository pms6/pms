"use client";

import AccessNoticesBoard from "../../Shared/AccessNoticesBoard";

// The board lives in Shared/AccessNoticesBoard so the owner and manager
// portals issue and track notices the same way.
export default function ManagerAccessNotices() {
  return <AccessNoticesBoard />;
}
