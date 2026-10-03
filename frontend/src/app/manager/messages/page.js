"use client";

import TenantMessagesBoard from "../../Shared/TenantMessagesBoard";

// The board lives in Shared/TenantMessagesBoard so the owner and manager
// portals message tenants the same way.
export default function ManagerMessages() {
  return <TenantMessagesBoard />;
}
