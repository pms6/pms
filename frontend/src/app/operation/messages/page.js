"use client";

import TenantMessagesBoard from "../../Shared/TenantMessagesBoard";

// The board lives in Shared/TenantMessagesBoard so every staff portal
// messages tenants the same way.
export default function OperationMessages() {
  return <TenantMessagesBoard />;
}
