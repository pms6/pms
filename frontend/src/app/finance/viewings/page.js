"use client";

import ViewingsBoard from "../../Shared/ViewingsBoard";

// The board lives in Shared/ViewingsBoard so scheduling, completing and
// re-opening a finished viewing behave the same in every staff portal.
// Tenants get /tenant/viewing instead.
export default function FinanceViewings() {
  return <ViewingsBoard subtitle="Scheduled property viewings" />;
}
